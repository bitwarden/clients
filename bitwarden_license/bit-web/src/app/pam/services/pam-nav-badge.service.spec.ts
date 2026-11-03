import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, Subscription } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService } from "../abstractions/access-event.service";
import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { ApprovalSdkService } from "../abstractions/approval-sdk.service";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";

import { DefaultAccessRefreshService } from "./default-access-refresh.service";
import { DefaultPamNavBadgeService } from "./pam-nav-badge.service";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

let nextId = 0;

/** An actionable request by both filters: pending or startable, and not timed out. */
function request(
  status: AccessRequestStatus,
  id = `req-${++nextId}`,
  leaseNotAfter = FUTURE,
): AccessRequestView {
  return { id, status, leaseNotAfter } as unknown as AccessRequestView;
}

const pamOrg = { usePam: true } as Organization;
const nonPamOrg = { usePam: false } as Organization;

describe("DefaultPamNavBadgeService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let approvalsApi: MockProxy<ApprovalSdkService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;
  let enabled$: BehaviorSubject<boolean>;
  let canApprove$: BehaviorSubject<boolean>;
  let push$: Subject<void>;
  let inboxPush$: Subject<void>;
  let ticks$: Subject<number>;
  let organizations$: BehaviorSubject<Organization[]>;
  let accessEvents: AccessEventService;
  let accessRefresh: DefaultAccessRefreshService;
  let approvalPrivileges: ApprovalPrivilegeService;
  let service: DefaultPamNavBadgeService;
  const subscriptions: Subscription[] = [];

  function watch(): number[] {
    const seen: number[] = [];
    subscriptions.push(service.count$.subscribe((n) => seen.push(n)));
    return seen;
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    nextId = 0;
    requestsApi = mock<AccessRequestSdkService>();
    approvalsApi = mock<ApprovalSdkService>();
    configService = mock<ConfigService>();
    logService = mock<LogService>();
    enabled$ = new BehaviorSubject<boolean>(true);
    canApprove$ = new BehaviorSubject<boolean>(true);
    push$ = new Subject<void>();
    inboxPush$ = new Subject<void>();
    ticks$ = new Subject<number>();
    organizations$ = new BehaviorSubject<Organization[]>([pamOrg]);
    accessEvents = {
      accessChanged$: () => push$.asObservable(),
      approverInboxChanged$: () => inboxPush$.asObservable(),
    };
    // The real one, so a push reaches the badge through it as in the app.
    accessRefresh = new DefaultAccessRefreshService(accessEvents);
    approvalPrivileges = { canApprove$ } as unknown as ApprovalPrivilegeService;

    configService.getFeatureFlag$.mockReturnValue(enabled$ as never);
    requestsApi.listMyAccessRequests.mockResolvedValue([]);
    approvalsApi.listInbox.mockResolvedValue([]);

    service = new DefaultPamNavBadgeService(
      requestsApi,
      approvalsApi,
      approvalPrivileges,
      accessEvents,
      accessRefresh,
      { ticks$ } as unknown as AccessBadgeTickerService,
      {
        activeAccount$: new BehaviorSubject({ id: "user-id" as UserId }),
      } as unknown as AccountService,
      { organizations$: () => organizations$ } as unknown as OrganizationService,
      configService,
      logService,
    );
  });

  afterEach(() => {
    subscriptions.forEach((s) => s.unsubscribe());
    subscriptions.length = 0;
  });

  it("reports the caller's actionable request count", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([
      request("pending"),
      request("approved"),
      request("denied"),
    ]);

    const seen = watch();
    await settle();

    expect(seen.at(-1)).toBe(2);
  });

  it("adds the requests awaiting the caller's decision", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    approvalsApi.listInbox.mockResolvedValue([request("pending"), request("pending")]);

    const seen = watch();
    await settle();

    expect(seen.at(-1)).toBe(3);
  });

  it("counts a request the caller both raised and manages once", async () => {
    const own = request("pending", "shared-id");
    requestsApi.listMyAccessRequests.mockResolvedValue([own]);
    approvalsApi.listInbox.mockResolvedValue([own]);

    const seen = watch();
    await settle();

    expect(seen.at(-1)).toBe(1);
  });

  it("never reads the inbox for a caller who cannot approve", async () => {
    canApprove$.next(false);
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);

    const seen = watch();
    await settle();

    expect(seen.at(-1)).toBe(1);
    expect(approvalsApi.listInbox).not.toHaveBeenCalled();
  });

  it("drops the approver half when the privilege goes away", async () => {
    approvalsApi.listInbox.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    canApprove$.next(false);
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it("reports 0 and calls no SDK method while the feature flag is off", async () => {
    enabled$.next(false);

    const seen = watch();
    await settle();

    expect(seen).toEqual([0]);
    expect(requestsApi.listMyAccessRequests).not.toHaveBeenCalled();
    expect(approvalsApi.listInbox).not.toHaveBeenCalled();
  });

  it("reads nothing for a user in no PAM organization", async () => {
    organizations$.next([nonPamOrg]);

    const seen = watch();
    await settle();

    expect(seen).toEqual([0]);
    expect(requestsApi.listMyAccessRequests).not.toHaveBeenCalled();
    expect(approvalsApi.listInbox).not.toHaveBeenCalled();
  });

  it("does not re-read when the organizations re-emit with the same membership", async () => {
    watch();
    await settle();

    organizations$.next([pamOrg, nonPamOrg]);
    await settle();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
  });

  it("drops the caller's request once its window ends, with no push", async () => {
    const endMs = Date.parse(FUTURE);
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    requestsApi.listMyAccessRequests.mockResolvedValue([request("expired")]);
    ticks$.next(endMs - 1);
    await settle();
    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);

    ticks$.next(endMs);
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it("drops an inbox request once its window ends, with no push", async () => {
    approvalsApi.listInbox.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    approvalsApi.listInbox.mockResolvedValue([]);
    ticks$.next(Date.parse(FUTURE));
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it("runs no clock while nothing is counted", async () => {
    watch();
    await settle();

    expect(ticks$.observed).toBe(false);
  });

  it("does not wait on the clock for a pending request whose end has passed", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending", "late", past)]);

    const seen = watch();
    await settle();

    expect(seen.at(-1)).toBe(1);
    expect(ticks$.observed).toBe(false);
  });

  it("re-reads and re-reports on a server push", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending"), request("pending")]);
    push$.next();
    await settle();

    expect(seen.at(-1)).toBe(2);
  });

  it("re-reads the inbox on the approver push", async () => {
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(0);

    approvalsApi.listInbox.mockResolvedValue([request("pending")]);
    inboxPush$.next();
    await settle();

    expect(seen.at(-1)).toBe(1);
  });

  it("drops the approver's own decision without waiting on a push", async () => {
    approvalsApi.listInbox.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    approvalsApi.listInbox.mockResolvedValue([]);
    accessRefresh.notifyAccessChanged();
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it("drops the caller's own cancel or start without waiting on a push", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(1);

    requestsApi.listMyAccessRequests.mockResolvedValue([request("canceled")]);
    accessRefresh.notifyAccessChanged("cipher-1");
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it("does not re-emit when the count is unchanged", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();

    push$.next();
    await settle();

    expect(seen).toEqual([0, 1]);
  });

  it("keeps the previous count and logs when the read fails", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();

    requestsApi.listMyAccessRequests.mockRejectedValue(new Error("boom"));
    push$.next();
    await settle();

    expect(seen.at(-1)).toBe(1);
    expect(logService.error).toHaveBeenCalled();
  });

  it("keeps the approver half's previous count when the inbox read fails", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([request("pending")]);
    approvalsApi.listInbox.mockResolvedValue([request("pending")]);
    const seen = watch();
    await settle();
    expect(seen.at(-1)).toBe(2);

    approvalsApi.listInbox.mockRejectedValue(new Error("boom"));
    inboxPush$.next();
    await settle();

    expect(seen.at(-1)).toBe(2);
    expect(logService.error).toHaveBeenCalled();
  });

  it("shares one read across several subscribers", async () => {
    watch();
    watch();
    await settle();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
    expect(approvalsApi.listInbox).toHaveBeenCalledTimes(1);
  });

  it("releases the push subscriptions once nothing is badging", async () => {
    const subscription = service.count$.subscribe();
    await settle();
    expect(push$.observed).toBe(true);
    expect(inboxPush$.observed).toBe(true);

    subscription.unsubscribe();

    expect(push$.observed).toBe(false);
    expect(inboxPush$.observed).toBe(false);
  });
});
