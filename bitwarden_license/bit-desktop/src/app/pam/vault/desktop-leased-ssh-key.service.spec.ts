import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService } from "@bitwarden/bit-pam";
import type { AccessLeaseView } from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LeasedSshKey } from "@bitwarden/desktop/autofill/abstractions/leased-ssh-key.service";

import { DesktopLeasedSshKeyService } from "./desktop-leased-ssh-key.service";
import { DesktopRevealedCipherService, RevealedEntry } from "./desktop-revealed-cipher.service";

describe("DesktopLeasedSshKeyService", () => {
  const userId = "user-1" as UserId;
  const otherUserId = "user-2" as UserId;
  const sshCipherId = "ssh-1" as CipherId;
  const loginCipherId = "login-1" as CipherId;
  const nowMs = new Date("2026-10-16T12:00:00Z").getTime();
  const leaseEndMs = nowMs + 60_000;

  let leases: AccessLeaseView[];
  let listViews$: BehaviorSubject<unknown[]>;
  let entries$: BehaviorSubject<Map<CipherId, RevealedEntry>>;
  let accessChanged$: Subject<void>;
  let ticks$: Subject<number>;
  let pamFlag$: BehaviorSubject<boolean>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let revealed: {
    liveEntry: jest.Mock;
    revealedEntries$: jest.Mock;
    refresh: jest.Mock;
  };
  let accessLeaseSdkService: MockProxy<AccessLeaseSdkService>;
  let logService: MockProxy<LogService>;
  let service: DesktopLeasedSshKeyService;
  let emitted: LeasedSshKey[][];
  let subscription: Subscription;

  const lease = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
      id: "lease-1",
      cipherId: sshCipherId,
      status: "active",
      notAfter: new Date(leaseEndMs).toISOString(),
      ...overrides,
    }) as unknown as AccessLeaseView;

  const gatedListView = (id: CipherId, type: unknown) => ({ id, type, partial: true });

  const sshView = (overrides: Partial<CipherView> = {}) =>
    ({
      id: sshCipherId,
      name: "Prod bastion",
      type: CipherType.SshKey,
      isDeleted: false,
      isArchived: false,
      sshKey: { privateKey: "leased-pem" },
      ...overrides,
    }) as unknown as CipherView;

  /** Moves the clock and ticks the shared ticker once. */
  const tickAt = (ms: number) => {
    jest.setSystemTime(ms);
    ticks$.next(ms);
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const latest = () => emitted[emitted.length - 1];

  beforeEach(() => {
    jest.useFakeTimers({ now: nowMs });
    leases = [lease()];
    listViews$ = new BehaviorSubject<unknown[]>([
      gatedListView(sshCipherId, "sshKey"),
      gatedListView(loginCipherId, { login: {} }),
    ]);
    entries$ = new BehaviorSubject(new Map<CipherId, RevealedEntry>());
    accessChanged$ = new Subject<void>();
    ticks$ = new Subject<number>();
    pamFlag$ = new BehaviorSubject(true);
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);

    // A stand-in for the reveal service: `refresh` reveals the view under the lease's end, and
    // entries are read against the clock like the real one.
    const live = () =>
      new Map([...entries$.value].filter(([, entry]) => entry.endsAt > Date.now()));
    revealed = {
      liveEntry: jest.fn((_: UserId, cipherId: CipherId) => live().get(cipherId)),
      revealedEntries$: jest.fn(() => entries$.asObservable()),
      refresh: jest.fn(async (_: UserId, cipherId: CipherId) => {
        const held = leases.find((l) => (l.cipherId as unknown as string) === cipherId);
        const next = new Map(entries$.value);
        if (held == null || held.status !== "active") {
          next.delete(cipherId);
        } else {
          next.set(cipherId, { view: sshView(), endsAt: Date.parse(held.notAfter) });
        }
        entries$.next(next);
      }),
    };

    accessLeaseSdkService = mock<AccessLeaseSdkService>();
    accessLeaseSdkService.listMyLeases.mockImplementation(async () => leases);
    const accessRefreshService = mock<AccessRefreshService>();
    accessRefreshService.accessChanged$.mockReturnValue(accessChanged$);
    const ticker = { ticks$: ticks$ as Observable<number> } as AccessBadgeTickerService;
    const cipherService = mock<CipherService>();
    cipherService.cipherListViewsIncludingRestricted$.mockReturnValue(listViews$ as never);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(pamFlag$ as never);
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      new BehaviorSubject([{ usePam: true } as Organization]),
    );
    const accountService = { activeAccount$ } as unknown as AccountService;
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(authStatus$);
    logService = mock<LogService>();

    service = new DesktopLeasedSshKeyService(
      revealed as unknown as DesktopRevealedCipherService,
      accessLeaseSdkService,
      accessRefreshService,
      ticker,
      cipherService,
      configService,
      organizationService,
      accountService,
      authService,
      logService,
    );
    emitted = [];
  });

  afterEach(() => {
    subscription?.unsubscribe();
    jest.useRealTimers();
  });

  const watch = async (forUser = userId) => {
    subscription = service.leasedKeys$(forUser).subscribe((keys) => emitted.push(keys));
    await flush();
  };

  it("reveals a leased SSH key and lists it with its lease end while the lease is live", async () => {
    await watch();

    expect(revealed.refresh).toHaveBeenCalledWith(userId, sshCipherId);
    expect(latest()).toEqual([
      {
        cipherId: sshCipherId,
        name: "Prod bastion",
        privateKey: "leased-pem",
        leaseEndsAt: leaseEndMs,
      },
    ]);
    expect(service.liveKey(userId, sshCipherId)?.leaseEndsAt).toBe(leaseEndMs);
    expect(service.liveKeys(userId)).toHaveLength(1);
  });

  it("does not reveal a leased item that is not an SSH key", async () => {
    leases = [lease({ cipherId: loginCipherId })];

    await watch();

    expect(revealed.refresh).not.toHaveBeenCalled();
    expect(latest()).toEqual([]);
  });

  it("does not reveal a gated SSH key without a live lease", async () => {
    leases = [lease({ status: "expired" })];

    await watch();

    expect(revealed.refresh).not.toHaveBeenCalled();
    expect(latest()).toEqual([]);
  });

  it("drops the key once the lease ends, on the shared clock", async () => {
    await watch();
    expect(latest()).toHaveLength(1);

    tickAt(leaseEndMs);
    await flush();

    expect(latest()).toEqual([]);
    expect(service.liveKey(userId, sshCipherId)).toBeUndefined();
  });

  it("answers no live key past the lease end even before the clock ticks", async () => {
    await watch();

    jest.setSystemTime(leaseEndMs + 1);

    expect(service.liveKey(userId, sshCipherId)).toBeUndefined();
    expect(service.liveKeys(userId)).toEqual([]);
  });

  it("drops the key when the lease is revoked or ended", async () => {
    await watch();

    leases = [lease({ status: "revoked" })];
    accessChanged$.next();
    await flush();

    expect(latest()).toEqual([]);
    expect(service.liveKey(userId, sshCipherId)).toBeUndefined();
  });

  it("re-reveals after an extension so the key carries the new lease end", async () => {
    await watch();

    const extendedEnd = leaseEndMs + 30 * 60_000;
    leases = [lease({ notAfter: new Date(extendedEnd).toISOString() })];
    accessChanged$.next();
    await flush();

    expect(revealed.refresh).toHaveBeenCalledTimes(2);
    expect(latest()[0].leaseEndsAt).toBe(extendedEnd);
  });

  it("never extends a key past the end of the view it was revealed under", async () => {
    await watch();

    // The lease reads as extended, but the held view still ends at the old end.
    revealed.refresh.mockResolvedValue(undefined);
    leases = [lease({ notAfter: new Date(leaseEndMs + 60_000).toISOString() })];
    accessChanged$.next();
    await flush();

    expect(latest()[0].leaseEndsAt).toBe(leaseEndMs);
  });

  it.each([
    ["lock", () => authStatus$.next(AuthenticationStatus.Locked)],
    ["logout", () => authStatus$.next(AuthenticationStatus.LoggedOut)],
    ["account switch", () => activeAccount$.next({ id: otherUserId } as Account)],
  ])("emits no keys and answers no live key on %s", async (_, act) => {
    await watch();
    expect(latest()).toHaveLength(1);

    act();
    await flush();

    expect(latest()).toEqual([]);
    expect(service.liveKey(userId, sshCipherId)).toBeUndefined();
  });

  it("answers no live key once the agent stops listening", async () => {
    await watch();

    subscription.unsubscribe();

    expect(service.liveKey(userId, sshCipherId)).toBeUndefined();
  });

  it("reads nothing and lists nothing with the PAM flag off", async () => {
    pamFlag$.next(false);

    await watch();

    expect(accessLeaseSdkService.listMyLeases).not.toHaveBeenCalled();
    expect(latest()).toEqual([]);
  });

  it("keeps the last lease answer when a re-read fails, still bounded by the lease end", async () => {
    await watch();

    accessLeaseSdkService.listMyLeases.mockRejectedValueOnce(new Error("offline"));
    accessChanged$.next();
    await flush();

    expect(latest()).toHaveLength(1);

    tickAt(leaseEndMs);
    await flush();

    expect(latest()).toEqual([]);
  });

  it("grants nothing when the first lease read fails", async () => {
    accessLeaseSdkService.listMyLeases.mockRejectedValueOnce(new Error("offline"));

    await watch();

    expect(revealed.refresh).not.toHaveBeenCalled();
    expect(latest()).toEqual([]);
  });
});
