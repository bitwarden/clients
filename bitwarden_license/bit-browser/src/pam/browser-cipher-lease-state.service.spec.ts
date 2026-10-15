import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { BrowserCipherLeaseStateService } from "./browser-cipher-lease-state.service";
import { at, leaseEntry, NOW, seedLeases } from "./leased-cipher.state.spec-util";

describe("BrowserCipherLeaseStateService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let service: BrowserCipherLeaseStateService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    service = new BrowserCipherLeaseStateService(stateProvider, accountService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("leasedCiphers$", () => {
    it("emits only copies whose lease is still live", async () => {
      await seedLeases(stateProvider, userId, [
        leaseEntry("live", at(60_000)),
        leaseEntry("lapsed", at(-1)),
        leaseEntry("garbled", "not-a-date"),
      ]);

      const ciphers = await firstValueFrom(service.leasedCiphers$(userId));

      expect(ciphers.map((cipher) => cipher.id)).toEqual(["live"]);
    });

    it("emits nothing leased when there is no state", async () => {
      const ciphers = await firstValueFrom(service.leasedCiphers$(userId));

      expect(ciphers).toEqual([]);
    });

    it("re-emits without the copy once its lease lapses", async () => {
      await seedLeases(stateProvider, userId, [
        leaseEntry("first", at(60_000)),
        leaseEntry("second", at(120_000)),
      ]);
      const emissions: string[][] = [];

      const subscription = service
        .leasedCiphers$(userId)
        .subscribe((ciphers) => emissions.push(ciphers.map((cipher) => cipher.id)));
      jest.advanceTimersByTime(60_000);
      jest.advanceTimersByTime(60_000);
      subscription.unsubscribe();

      expect(emissions).toEqual([["first", "second"], ["second"], []]);
    });

    it("does not re-emit for a refresh that changes no copy", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("live", at(60_000))]);
      let emissions = 0;

      const subscription = service.leasedCiphers$(userId).subscribe(() => emissions++);
      await seedLeases(stateProvider, userId, [leaseEntry("live", at(60_000))], NOW + 1);
      subscription.unsubscribe();

      expect(emissions).toBe(1);
    });
  });

  describe("leasedCipherIds", () => {
    it("returns the active user's live leased ids", async () => {
      await seedLeases(stateProvider, userId, [
        leaseEntry("mine", at(60_000)),
        leaseEntry("lapsed", at(-1)),
      ]);
      await seedLeases(stateProvider, otherUserId, [leaseEntry("theirs", at(60_000))]);

      const ids = await service.leasedCipherIds();

      expect(ids).toEqual(new Set(["mine"]));
    });

    it("returns no ids without an active user", async () => {
      await seedLeases(stateProvider, userId, [leaseEntry("mine", at(60_000))]);
      accountService.activeAccountSubject.next(null);

      const ids = await service.leasedCipherIds();

      expect(ids).toEqual(new Set());
    });
  });
});
