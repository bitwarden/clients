import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

import { BrowserCipherLeaseStateService } from "./browser-cipher-lease-state.service";
import { LEASED_CIPHERS, LeasedCipherEntry } from "./leased-cipher.state";

describe("BrowserCipherLeaseStateService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;
  const now = new Date("2026-10-15T12:00:00.000Z").getTime();

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let service: BrowserCipherLeaseStateService;

  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const entry = (cipherId: string, notAfter: string): LeasedCipherEntry => ({
    leaseId: `lease-${cipherId}`,
    notAfter,
    cipher: Object.assign(new CipherData(), { id: cipherId }),
  });
  const setLeases = (forUserId: UserId, ...entries: LeasedCipherEntry[]) =>
    stateProvider.setUserState(
      LEASED_CIPHERS,
      {
        refreshedAt: now,
        leases: Object.fromEntries(entries.map((e) => [e.cipher.id, e])),
      },
      forUserId,
    );

  beforeEach(() => {
    jest.useFakeTimers({ now });
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    service = new BrowserCipherLeaseStateService(stateProvider, accountService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("leasedCiphers$", () => {
    it("emits only copies whose lease is still live", async () => {
      await setLeases(
        userId,
        entry("live", at(60_000)),
        entry("lapsed", at(-1)),
        entry("garbled", "not-a-date"),
      );

      const ciphers = await firstValueFrom(service.leasedCiphers$(userId));

      expect(ciphers.map((cipher) => cipher.id)).toEqual(["live"]);
    });

    it("emits nothing leased when there is no state", async () => {
      const ciphers = await firstValueFrom(service.leasedCiphers$(userId));

      expect(ciphers).toEqual([]);
    });

    it("re-emits without the copy once its lease lapses", async () => {
      await setLeases(userId, entry("first", at(60_000)), entry("second", at(120_000)));
      const emissions: string[][] = [];

      const subscription = service
        .leasedCiphers$(userId)
        .subscribe((ciphers) => emissions.push(ciphers.map((cipher) => cipher.id)));
      jest.advanceTimersByTime(60_000);
      jest.advanceTimersByTime(60_000);
      subscription.unsubscribe();

      expect(emissions).toEqual([["first", "second"], ["second"], []]);
    });
  });

  describe("leasedCipherIds", () => {
    it("returns the active user's live leased ids", async () => {
      await setLeases(userId, entry("mine", at(60_000)), entry("lapsed", at(-1)));
      await setLeases(otherUserId, entry("theirs", at(60_000)));

      const ids = await service.leasedCipherIds();

      expect(ids).toEqual(new Set(["mine"]));
    });

    it("returns no ids without an active user", async () => {
      await setLeases(userId, entry("mine", at(60_000)));
      accountService.activeAccountSubject.next(null);

      const ids = await service.leasedCipherIds();

      expect(ids).toEqual(new Set());
    });
  });
});
