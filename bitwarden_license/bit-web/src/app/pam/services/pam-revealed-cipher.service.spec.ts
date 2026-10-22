import { NgZone } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherView as SdkCipherView } from "@bitwarden/sdk-internal";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

import { PamRevealedCipherService } from "./pam-revealed-cipher.service";

describe("PamRevealedCipherService", () => {
  const userId = "user-1" as UserId;
  const cipherId = "cipher-1" as CipherId;
  const nowMs = new Date("2026-10-16T12:00:00Z").getTime();

  let state: CipherAccessStateView;
  let accessRequestSdkService: MockProxy<AccessRequestSdkService>;
  let accessLeaseSdkService: MockProxy<AccessLeaseSdkService>;
  let accessRefreshService: MockProxy<AccessRefreshService>;
  let accessChanged$: Subject<void>;
  let ticks$: Subject<number>;
  let ticker: AccessBadgeTickerService;
  let accountService: AccountService;
  let activeAccount$: BehaviorSubject<Account | null>;
  let authService: MockProxy<AuthService>;
  let authStatuses$: Subject<Record<UserId, AuthenticationStatus>>;
  let logService: MockProxy<LogService>;
  let ngZone: NgZone;
  let service: PamRevealedCipherService;

  /** A state with a live lease ending `ms` from the start of the test. */
  const leaseEndingIn = (ms = 60_000) =>
    ({
      cipherId,
      activeLease: { id: "lease-1", notAfter: new Date(nowMs + ms).toISOString() },
    }) as unknown as CipherAccessStateView;

  const noLease = () => ({ cipherId, activeLease: undefined }) as unknown as CipherAccessStateView;

  const sdkView = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({ id: cipherId, name: "Prod database", ...overrides }) as unknown as SdkCipherView;

  const storedView = () => {
    const view = new CipherView();
    view.id = cipherId;
    view.partial = true;
    return view;
  };

  /** Changes the access state and tells the open subscriptions to read it again. */
  const setState = (next: CipherAccessStateView) => {
    state = next;
    accessChanged$.next();
  };

  /** Moves the clock and ticks the shared ticker once. */
  const tickAt = (ms: number) => {
    jest.setSystemTime(nowMs + ms);
    ticks$.next(nowMs + ms);
  };

  /** Lets the promise chains inside the pipelines settle. */
  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const createService = () =>
    new PamRevealedCipherService(
      accessRequestSdkService,
      accessRefreshService,
      ticker,
      accessLeaseSdkService,
      accountService,
      authService,
      ngZone,
      logService,
    );

  beforeEach(() => {
    jest.useFakeTimers({ now: nowMs });
    state = noLease();
    accessRequestSdkService = mock<AccessRequestSdkService>();
    accessRequestSdkService.getCipherAccessState.mockImplementation(async () => state);
    accessLeaseSdkService = mock<AccessLeaseSdkService>();
    accessLeaseSdkService.leasedCipher.mockImplementation(async () => sdkView());
    accessChanged$ = new Subject<void>();
    accessRefreshService = mock<AccessRefreshService>();
    accessRefreshService.accessChanged$.mockReturnValue(accessChanged$);
    ticks$ = new Subject<number>();
    ticker = { ticks$: ticks$ as Observable<number> } as AccessBadgeTickerService;
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    accountService = { activeAccount$ } as unknown as AccountService;
    authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({
      [userId]: AuthenticationStatus.Unlocked,
    });
    authService = mock<AuthService>();
    Object.defineProperty(authService, "authStatuses$", { value: authStatuses$ });
    logService = mock<LogService>();
    ngZone = { run: jest.fn((fn: () => unknown) => fn()) } as unknown as NgZone;

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getOrReveal", () => {
    it("reveals and stores a cipher under a live lease", async () => {
      state = leaseEndingIn();

      const view = await service.getOrReveal(userId, cipherId);

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith(cipherId);
      expect(accessLeaseSdkService.leasedCipher).toHaveBeenCalledWith(cipherId);
      expect(view?.id).toBe(cipherId);
      expect(view?.partial).toBe(false);
      expect(service.isRevealed(userId, cipherId)).toBe(true);
      expect(service.get(userId, cipherId)).toBe(view);
    });

    it("returns the stored view without revealing again", async () => {
      state = leaseEndingIn();
      const first = await service.getOrReveal(userId, cipherId);

      const second = await service.getOrReveal(userId, cipherId);

      expect(second).toBe(first);
      expect(accessLeaseSdkService.leasedCipher).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["no lease", noLease()],
      ["a lapsed lease", leaseEndingIn(-1)],
    ])("refuses a cipher with %s", async (_, current) => {
      state = current;

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
      expect(accessLeaseSdkService.leasedCipher).not.toHaveBeenCalled();
    });

    it("refuses for a user who is not active", async () => {
      state = leaseEndingIn();

      await expect(service.getOrReveal("user-2" as UserId, cipherId)).resolves.toBeNull();
      expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
      expect(accessLeaseSdkService.leasedCipher).not.toHaveBeenCalled();
    });

    it("does not store a still-restricted view", async () => {
      state = leaseEndingIn();
      accessLeaseSdkService.leasedCipher.mockResolvedValue(sdkView({ partial: true }));

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("does not store a view of another cipher", async () => {
      state = leaseEndingIn();
      accessLeaseSdkService.leasedCipher.mockResolvedValue(sdkView({ id: "cipher-2" }));

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("returns null when the SDK has no leased cipher", async () => {
      state = leaseEndingIn();
      accessLeaseSdkService.leasedCipher.mockResolvedValue(undefined);

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
    });

    it("returns null and logs the error when the read fails", async () => {
      state = leaseEndingIn();
      const error = new Error("boom");
      accessLeaseSdkService.leasedCipher.mockRejectedValue(error);

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
      expect(logService.error).toHaveBeenCalledWith(error);
    });

    it.each([
      ["a lock", { [userId]: AuthenticationStatus.Locked }],
      ["a logout", {}],
    ])("does not store a reveal that resolves after %s", async (_, statuses) => {
      state = leaseEndingIn();
      let resolveRead: (view: SdkCipherView) => void = () => {};
      accessLeaseSdkService.leasedCipher.mockReturnValue(
        new Promise((resolve) => (resolveRead = resolve)),
      );

      const pending = service.getOrReveal(userId, cipherId);
      await flush();
      authStatuses$.next(statuses as Record<UserId, AuthenticationStatus>);
      resolveRead(sdkView());

      await expect(pending).resolves.toBeNull();
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("does not store a reveal that resolves after a lock and an unlock", async () => {
      state = leaseEndingIn();
      let resolveRead: (view: SdkCipherView) => void = () => {};
      accessLeaseSdkService.leasedCipher.mockReturnValue(
        new Promise((resolve) => (resolveRead = resolve)),
      );

      const pending = service.getOrReveal(userId, cipherId);
      await flush();
      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });
      authStatuses$.next({ [userId]: AuthenticationStatus.Unlocked });
      resolveRead(sdkView());

      await expect(pending).resolves.toBeNull();
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("stores nothing before the first auth status", async () => {
      authStatuses$ = new Subject<Record<UserId, AuthenticationStatus>>();
      authService = mock<AuthService>();
      Object.defineProperty(authService, "authStatuses$", { value: authStatuses$ });
      service = createService();
      state = leaseEndingIn();

      await expect(service.getOrReveal(userId, cipherId)).resolves.toBeNull();
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });
  });

  describe("expiry", () => {
    beforeEach(async () => {
      state = leaseEndingIn();
      await service.getOrReveal(userId, cipherId);
      (ngZone.run as jest.Mock).mockClear();
    });

    it("drops a lapsed view on the shared ticker, re-entering the zone only then", () => {
      const emissions: number[] = [];
      service.revealed$(userId).subscribe((views) => emissions.push(views.size));

      tickAt(30_000);
      expect(ngZone.run).not.toHaveBeenCalled();

      tickAt(60_000);

      expect(ngZone.run).toHaveBeenCalledTimes(1);
      expect(service.isRevealed(userId, cipherId)).toBe(false);
      expect(emissions).toEqual([1, 0]);
    });

    it("ignores a lapsed view on read before the next tick", () => {
      jest.setSystemTime(nowMs + 60_000);

      expect(service.get(userId, cipherId)).toBeUndefined();
    });

    it("starts no timers of its own, and leaves the ticker once it holds no views", () => {
      expect(jest.getTimerCount()).toBe(0);
      expect(ticks$.observed).toBe(true);

      tickAt(60_000);

      expect(ticks$.observed).toBe(false);
    });
  });

  describe("clearing on auth status", () => {
    beforeEach(async () => {
      state = leaseEndingIn();
      await service.getOrReveal(userId, cipherId);
    });

    it("keeps views while the user is unlocked", () => {
      authStatuses$.next({ [userId]: AuthenticationStatus.Unlocked });

      expect(service.isRevealed(userId, cipherId)).toBe(true);
    });

    it("clears on lock", () => {
      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });

      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("clears a user missing from the statuses (logged out)", () => {
      authStatuses$.next({});

      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });
  });

  describe("refresh", () => {
    beforeEach(async () => {
      state = leaseEndingIn();
      await service.getOrReveal(userId, cipherId);
    });

    it("reveals again", async () => {
      const first = service.get(userId, cipherId);
      accessLeaseSdkService.leasedCipher.mockResolvedValue(sdkView({ name: "Renamed" }));

      await service.refresh(userId, cipherId);

      expect(service.get(userId, cipherId)).not.toBe(first);
      expect(service.get(userId, cipherId)?.name).toBe("Renamed");
    });

    it("drops the view when the read gives none", async () => {
      accessLeaseSdkService.leasedCipher.mockResolvedValue(undefined);

      await service.refresh(userId, cipherId);

      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("drops the view when the lease is gone", async () => {
      state = noLease();

      await service.refresh(userId, cipherId);

      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });
  });

  describe("displayView$", () => {
    it("passes an unrestricted view through", async () => {
      const view = new CipherView();
      view.id = cipherId;

      await expect(firstValueFrom(service.displayView$(userId, view))).resolves.toBe(view);
      expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("shows the stored view, then the revealed view once a lease starts", async () => {
      const stored = storedView();
      const emissions: CipherView[] = [];
      service.displayView$(userId, stored).subscribe((view) => emissions.push(view));
      await flush();

      setState(leaseEndingIn());
      await flush();

      expect(accessRefreshService.accessChanged$).toHaveBeenCalledWith(cipherId);
      expect(emissions[0]).toBe(stored);
      expect(emissions[emissions.length - 1].partial).toBe(false);
      expect(ngZone.run).toHaveBeenCalled();
    });

    it("falls back to the stored view when the lease ends", async () => {
      const stored = storedView();
      state = leaseEndingIn();
      const emissions: CipherView[] = [];
      service.displayView$(userId, stored).subscribe((view) => emissions.push(view));
      await flush();

      setState(noLease());
      await flush();

      expect(emissions[emissions.length - 1]).toBe(stored);
      expect(service.isRevealed(userId, cipherId)).toBe(false);
    });

    it("keeps the last answer when a state read fails", async () => {
      state = leaseEndingIn();
      service.displayView$(userId, storedView()).subscribe();
      await flush();
      accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("offline"));

      accessChanged$.next();
      await flush();

      expect(service.isRevealed(userId, cipherId)).toBe(true);
    });

    it("reads again when the lease lapses and keeps a lease extended elsewhere", async () => {
      state = leaseEndingIn();
      service.displayView$(userId, storedView()).subscribe();
      await flush();
      state = leaseEndingIn(120_000);

      tickAt(60_000);
      await flush();

      expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
      expect(service.isRevealed(userId, cipherId)).toBe(true);
    });

    it("reveals again when the end time grows", async () => {
      state = leaseEndingIn();
      service.displayView$(userId, storedView()).subscribe();
      await flush();
      accessLeaseSdkService.leasedCipher.mockResolvedValue(sdkView({ name: "Extended" }));

      setState(leaseEndingIn(120_000));
      await flush();

      expect(accessLeaseSdkService.leasedCipher).toHaveBeenCalledTimes(2);
      expect(service.get(userId, cipherId)?.name).toBe("Extended");
      tickAt(60_000);
      expect(service.isRevealed(userId, cipherId)).toBe(true);
    });

    it("falls back when the lease lapses with no extension", async () => {
      const stored = storedView();
      state = leaseEndingIn();
      const emissions: CipherView[] = [];
      service.displayView$(userId, stored).subscribe((view) => emissions.push(view));
      await flush();

      tickAt(60_000);
      await flush();

      expect(emissions[emissions.length - 1]).toBe(stored);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
