import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserRevealedCipherService } from "./browser-revealed-cipher.service";
import { PAM_REFRESH_LEASES } from "./lease-messages";
import { at, leaseEntry, NOW, seedLeases } from "./leased-cipher.state.spec-util";

describe("BrowserRevealedCipherService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;
  const cipherId = "leased" as CipherId;

  let stateProvider: FakeStateProvider;
  let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;
  let cipherService: MockProxy<CipherService>;
  let messageSender: MockProxy<MessageSender>;
  let service: BrowserRevealedCipherService;

  const view = (id: string, partial = false) =>
    Object.assign(new CipherView(), { id, partial, name: id });
  const ids = (views: ReadonlyMap<CipherId, CipherView>) => [...views.keys()];
  /** Settles promises and timers due now, under fake timers. */
  const flush = () => jest.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({
      [userId]: AuthenticationStatus.Unlocked,
    });
    const authService = mock<AuthService>();
    authService.authStatuses$ = authStatuses$;
    cipherService = mock<CipherService>();
    cipherService.decrypt.mockImplementation(async (cipher: Cipher) => view(cipher.id));
    messageSender = mock<MessageSender>();

    service = new BrowserRevealedCipherService(
      stateProvider,
      authService,
      cipherService,
      messageSender,
      mock<LogService>(),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("revealed$", () => {
    it("emits the decrypted live copies of an unlocked user", async () => {
      await seedLeases(stateProvider, userId, [
        leaseEntry("leased", at(60_000)),
        leaseEntry("lapsed", at(-1)),
      ]);
      await flush();

      const revealed = await firstValueFrom(service.revealed$(userId));

      expect(ids(revealed)).toEqual(["leased"]);
      expect(cipherService.decrypt).toHaveBeenCalledWith(expect.any(Cipher), userId);
    });

    it("emits nothing for a user who is not unlocked", async () => {
      await seedLeases(stateProvider, otherUserId, [leaseEntry("theirs")]);
      await flush();

      expect(ids(await firstValueFrom(service.revealed$(otherUserId)))).toEqual([]);
    });

    it("drops a copy that decrypts to a partial view or another cipher", async () => {
      cipherService.decrypt.mockImplementation(async (cipher: Cipher) =>
        cipher.id === "partial" ? view("partial", true) : view("someone-else"),
      );
      await seedLeases(stateProvider, userId, [leaseEntry("partial"), leaseEntry("mismatch")]);
      await flush();

      expect(ids(await firstValueFrom(service.revealed$(userId)))).toEqual([]);
    });

    it("drops a copy that fails to decrypt", async () => {
      cipherService.decrypt.mockRejectedValue(new Error("boom"));
      await seedLeases(stateProvider, userId, [leaseEntry("leased")]);
      await flush();

      expect(ids(await firstValueFrom(service.revealed$(userId)))).toEqual([]);
    });

    it("clears the user's views in this process when the user locks", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("leased")]);
      await flush();

      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });
      await flush();

      expect(ids(await firstValueFrom(service.revealed$(userId)))).toEqual([]);
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("drops a view once its lease lapses", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("leased", at(60_000))]);
      await flush();
      expect(service.isRevealed(userId, cipherId)).toBe(true);

      await jest.advanceTimersByTimeAsync(60_000);

      expect(service.isRevealed(userId, cipherId)).toBe(false);
      expect(ids(await firstValueFrom(service.revealed$(userId)))).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns the live view synchronously", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("leased")]);
      await flush();

      expect(service.get(userId, cipherId)?.id).toBe("leased");
      expect(service.get(otherUserId, cipherId)).toBeUndefined();
    });
  });

  describe("displayView$", () => {
    it("returns a view that is not restricted as it is", async () => {
      const stored = view("leased");

      expect(await firstValueFrom(service.displayView$(userId, stored))).toBe(stored);
    });

    it("swaps in the revealed view of a restricted cipher, and the stored view without one", async () => {
      const stored = view("leased", true);
      const emissions: CipherView[] = [];
      const subscription = service
        .displayView$(userId, stored)
        .subscribe((shown) => emissions.push(shown));

      await seedLeases(stateProvider, userId, [leaseEntry("leased", at(60_000))]);
      await flush();
      await jest.advanceTimersByTimeAsync(60_000);
      subscription.unsubscribe();

      expect(emissions.map((shown) => shown.partial)).toEqual([true, false, true]);
      expect(emissions[2]).toBe(stored);
    });
  });

  describe("getOrReveal", () => {
    it("returns the live view without asking the background", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("leased")]);
      await flush();

      const revealed = await service.getOrReveal(userId, cipherId);

      expect(revealed?.id).toBe("leased");
      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it("asks the background for the cipher and returns its copy once written", async () => {
      messageSender.send.mockImplementation(() => {
        void seedLeases(stateProvider, userId, [leaseEntry("leased")], NOW);
      });

      const revealed = await service.getOrReveal(userId, cipherId);

      expect(messageSender.send).toHaveBeenCalledWith(PAM_REFRESH_LEASES, { userId, cipherId });
      expect(revealed?.id).toBe("leased");
    });

    it("returns null when the background writes no copy for the cipher", async () => {
      messageSender.send.mockImplementation(() => {
        void seedLeases(stateProvider, userId, [], NOW);
      });

      expect(await service.getOrReveal(userId, cipherId)).toBeNull();
    });

    it("returns null when the background does not answer in time", async () => {
      const revealed = service.getOrReveal(userId, cipherId);
      await jest.advanceTimersByTimeAsync(10_000);

      expect(await revealed).toBeNull();
    });
  });

  describe("refresh", () => {
    it("asks the background to re-fetch the cipher and waits for the write", async () => {
      let written = false;
      messageSender.send.mockImplementation(() => {
        void seedLeases(stateProvider, userId, [leaseEntry("leased")], NOW).then(
          () => (written = true),
        );
      });

      await service.refresh(userId, cipherId);

      expect(messageSender.send).toHaveBeenCalledWith(PAM_REFRESH_LEASES, { userId, cipherId });
      expect(written).toBe(true);
    });
  });
});
