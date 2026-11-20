import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService } from "@bitwarden/bit-pam";
import type { AccessLeaseView } from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";

import { PamRevealableCiphersService } from "./pam-revealable-ciphers.service";

describe("PamRevealableCiphersService", () => {
  const userId = "user-1" as UserId;
  const nowMs = new Date("2026-10-16T12:00:00Z").getTime();

  let leases: AccessLeaseView[];
  let accessLeaseSdkService: MockProxy<AccessLeaseSdkService>;
  let accessRefreshService: MockProxy<AccessRefreshService>;
  let accessChanged$: Subject<void>;
  let ticks$: Subject<number>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let organizations$: BehaviorSubject<Organization[]>;
  let flag$: BehaviorSubject<boolean>;
  let logService: MockProxy<LogService>;
  let service: PamRevealableCiphersService;
  let subscription: Subscription | undefined;

  /** A lease on `cipherId` ending `ms` from the start of the test. */
  const lease = (cipherId: string, ms = 60_000, status = "active") =>
    ({
      cipherId,
      status,
      notAfter: new Date(nowMs + ms).toISOString(),
    }) as unknown as AccessLeaseView;

  const licensedOrganization = () =>
    ({ canAccessPrivilegedAccess: true }) as unknown as Organization;

  /** Moves the clock and ticks the shared ticker once. */
  const tickAt = (ms: number) => {
    jest.setSystemTime(nowMs + ms);
    ticks$.next(nowMs + ms);
  };

  /** Lets the promise chains inside the pipeline settle. */
  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  /** Subscribes and returns the latest emission. */
  const watch = () => {
    const latest: { value?: ReadonlySet<CipherId> } = {};
    subscription = service.revealable$(userId).subscribe((ids) => (latest.value = ids));
    return latest;
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: nowMs });
    leases = [];
    accessLeaseSdkService = mock<AccessLeaseSdkService>();
    accessLeaseSdkService.listMyLeases.mockImplementation(async () => leases);
    accessChanged$ = new Subject<void>();
    accessRefreshService = mock<AccessRefreshService>();
    accessRefreshService.accessChanged$.mockReturnValue(accessChanged$);
    ticks$ = new Subject<number>();
    const ticker = { ticks$: ticks$ as Observable<number> } as AccessBadgeTickerService;
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    const accountService = { activeAccount$ } as unknown as AccountService;
    organizations$ = new BehaviorSubject<Organization[]>([licensedOrganization()]);
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(organizations$);
    flag$ = new BehaviorSubject<boolean>(true);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(flag$);
    logService = mock<LogService>();

    service = new PamRevealableCiphersService(
      accessLeaseSdkService,
      accessRefreshService,
      ticker,
      accountService,
      organizationService,
      configService,
      logService,
    );
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    jest.useRealTimers();
  });

  it("reports the ciphers the user holds a live, active lease on", async () => {
    leases = [lease("cipher-1"), lease("cipher-2", 60_000, "revoked"), lease("cipher-3", -1_000)];

    const latest = watch();
    await flush();

    expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledWith(userId);
    expect([...latest.value!]).toEqual(["cipher-1"]);
  });

  it("reads again when access changes", async () => {
    const latest = watch();
    await flush();
    expect(latest.value!.size).toBe(0);

    leases = [lease("cipher-1")];
    accessChanged$.next();
    await flush();

    expect([...latest.value!]).toEqual(["cipher-1"]);
  });

  it("drops a lease once it lapses and reads again", async () => {
    leases = [lease("cipher-1", 1_000), lease("cipher-2", 60_000)];
    const latest = watch();
    await flush();
    expect(latest.value!.size).toBe(2);

    leases = [lease("cipher-2", 60_000)];
    tickAt(1_000);
    await flush();

    expect([...latest.value!]).toEqual(["cipher-2"]);
    expect(accessLeaseSdkService.listMyLeases).toHaveBeenCalledTimes(2);
  });

  it("keeps a lease extended elsewhere once the read after its lapse returns it", async () => {
    leases = [lease("cipher-1", 1_000)];
    const latest = watch();
    await flush();

    leases = [lease("cipher-1", 60_000)];
    tickAt(1_000);
    await flush();

    expect([...latest.value!]).toEqual(["cipher-1"]);
  });

  it("reports none and logs when the read fails", async () => {
    const error = new Error("network");
    accessLeaseSdkService.listMyLeases.mockRejectedValue(error);

    const latest = watch();
    await flush();

    expect(latest.value!.size).toBe(0);
    expect(logService.error).toHaveBeenCalledWith(error);
  });

  it("reports none without a read for a user who is not the active one", async () => {
    activeAccount$.next({ id: "user-2" } as Account);

    const latest = watch();
    await flush();

    expect(latest.value!.size).toBe(0);
    expect(accessLeaseSdkService.listMyLeases).not.toHaveBeenCalled();
  });

  it("reports none without a read while the feature flag is off", async () => {
    flag$.next(false);

    const latest = watch();
    await flush();

    expect(latest.value!.size).toBe(0);
    expect(accessLeaseSdkService.listMyLeases).not.toHaveBeenCalled();
  });

  it("reports none without a read when no organization releases leased secrets", async () => {
    organizations$.next([{ canAccessPrivilegedAccess: false } as unknown as Organization]);

    const latest = watch();
    await flush();

    expect(latest.value!.size).toBe(0);
    expect(accessLeaseSdkService.listMyLeases).not.toHaveBeenCalled();
  });

  it("does not emit again when a read returns the same ciphers", async () => {
    leases = [lease("cipher-1")];
    const emissions: ReadonlySet<CipherId>[] = [];
    subscription = service.revealable$(userId).subscribe((ids) => emissions.push(ids));
    await flush();

    accessChanged$.next();
    await flush();

    expect(emissions).toHaveLength(1);
  });
});
