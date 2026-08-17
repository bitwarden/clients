import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, Subject, Subscription } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AccessEventService } from "../abstractions/access-event.service";
import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { DefaultPamNavBadgeService } from "./pam-nav-badge.service";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function request(status: AccessRequestStatus): AccessRequestView {
  return { status, leaseNotAfter: FUTURE } as unknown as AccessRequestView;
}

describe("DefaultPamNavBadgeService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;
  let enabled$: BehaviorSubject<boolean>;
  let push$: Subject<void>;
  let accessEvents: AccessEventService;
  let service: DefaultPamNavBadgeService;
  const subscriptions: Subscription[] = [];

  /** Collects the badge counts as they arrive. */
  function watch(): number[] {
    const seen: number[] = [];
    subscriptions.push(service.count$.subscribe((n) => seen.push(n)));
    return seen;
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    configService = mock<ConfigService>();
    logService = mock<LogService>();
    enabled$ = new BehaviorSubject<boolean>(true);
    push$ = new Subject<void>();
    accessEvents = {
      accessChanged$: () => push$.asObservable(),
      approverInboxChanged$: () => NEVER,
    };

    configService.getFeatureFlag$.mockReturnValue(enabled$ as never);
    requestsApi.listMyAccessRequests.mockResolvedValue([]);

    service = new DefaultPamNavBadgeService(requestsApi, accessEvents, configService, logService);
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

  it("reports 0 and calls no SDK method while the feature flag is off", async () => {
    enabled$.next(false);

    const seen = watch();
    await settle();

    expect(seen).toEqual([0]);
    expect(requestsApi.listMyAccessRequests).not.toHaveBeenCalled();
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

    // A nav badge must never be able to break navigation.
    expect(seen.at(-1)).toBe(1);
    expect(logService.error).toHaveBeenCalled();
  });

  it("shares one read across several subscribers", async () => {
    watch();
    watch();
    await settle();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
  });

  it("releases the push subscription once nothing is badging", async () => {
    const subscription = service.count$.subscribe();
    await settle();
    expect(push$.observed).toBe(true);

    subscription.unsubscribe();

    expect(push$.observed).toBe(false);
  });
});
