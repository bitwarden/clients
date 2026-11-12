import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-pam";
import type { AccessRequestView } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

import { MyAccessRequestsService } from "./my-access-requests.service";

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

function pending(cipherId: string, leaseNotAfter = inMinutes(60)): AccessRequestView {
  return {
    id: `req-${cipherId}`,
    cipherId,
    status: "pending",
    leaseNotAfter,
  } as unknown as AccessRequestView;
}

describe("MyAccessRequestsService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let logService: MockProxy<LogService>;
  let accessChanged$: Subject<void>;
  let ticks$: Subject<number>;
  let account$: BehaviorSubject<{ id: string } | null>;
  let service: MyAccessRequestsService;

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    requestsApi.listMyAccessRequests.mockResolvedValue([]);
    logService = mock<LogService>();
    accessChanged$ = new Subject<void>();
    ticks$ = new Subject<number>();
    account$ = new BehaviorSubject<{ id: string } | null>({ id: "user-1" });
    service = new MyAccessRequestsService(
      requestsApi,
      { accessChanged$: () => accessChanged$ } as unknown as AccessRefreshService,
      { activeAccount$: account$ } as unknown as AccountService,
      { ticks$ } as unknown as AccessBadgeTickerService,
      logService,
    );
  });

  it("reads once for every subscriber of the requests and the badges", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([pending("cipher-1")]);
    const subscriptions = [
      service.requests$.subscribe(),
      service.badges$.subscribe(),
      service.badges$.subscribe(),
    ];
    await settle();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
    expect(await firstValueFrom(service.badges$)).toEqual(
      new Map([["cipher-1", { kind: "pending" }]]),
    );
    subscriptions.forEach((s) => s.unsubscribe());
  });

  it("reads again on an access change", async () => {
    const seen: ReadonlyMap<string, unknown>[] = [];
    const subscription = service.badges$.subscribe((badges) => seen.push(badges));
    await settle();

    requestsApi.listMyAccessRequests.mockResolvedValue([pending("cipher-1")]);
    accessChanged$.next();
    await settle();
    subscription.unsubscribe();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(2);
    expect(seen.map((badges) => badges.size)).toEqual([0, 1]);
  });

  it("reads again once a window that gives a badge ends, since nothing announces it", async () => {
    const end = inMinutes(30);
    requestsApi.listMyAccessRequests.mockResolvedValue([pending("cipher-1", end)]);
    const subscription = service.requests$.subscribe();
    await settle();

    ticks$.next(Date.parse(end) - 1);
    await settle();
    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);

    ticks$.next(Date.parse(end));
    await settle();
    subscription.unsubscribe();

    expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(2);
  });

  it("runs no clock while no request gives a badge", async () => {
    const subscription = service.requests$.subscribe();
    await settle();

    expect(ticks$.observed).toBe(false);
    subscription.unsubscribe();
  });

  it("keeps the last good list and logs when a read fails", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValue([pending("cipher-1")]);
    const seen: (readonly AccessRequestView[])[] = [];
    const subscription = service.requests$.subscribe((requests) => seen.push(requests));
    await settle();

    requestsApi.listMyAccessRequests.mockRejectedValue(new Error("boom"));
    accessChanged$.next();
    await settle();
    subscription.unsubscribe();

    expect(seen).toHaveLength(1);
    expect(logService.error).toHaveBeenCalled();
  });

  it("drops the previous account's list on a switch, before the new account's read lands", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValueOnce([pending("cipher-1")]);
    const seen: ReadonlyMap<string, unknown>[] = [];
    const subscription = service.badges$.subscribe((badges) => seen.push(badges));
    await settle();

    let resolveSecond!: (requests: AccessRequestView[]) => void;
    requestsApi.listMyAccessRequests.mockReturnValueOnce(
      new Promise((resolve) => (resolveSecond = resolve)),
    );
    account$.next({ id: "user-2" });

    expect(seen.map((badges) => [...badges.keys()])).toEqual([["cipher-1"], []]);
    expect(await firstValueFrom(service.requests$)).toEqual([]);

    resolveSecond([pending("cipher-2")]);
    await settle();
    subscription.unsubscribe();

    expect(seen.map((badges) => [...badges.keys()])).toEqual([["cipher-1"], [], ["cipher-2"]]);
  });

  it("keeps the new account's list empty when its first read fails", async () => {
    requestsApi.listMyAccessRequests.mockResolvedValueOnce([pending("cipher-1")]);
    const seen: (readonly AccessRequestView[])[] = [];
    const subscription = service.requests$.subscribe((requests) => seen.push(requests));
    await settle();

    requestsApi.listMyAccessRequests.mockRejectedValueOnce(new Error("boom"));
    account$.next({ id: "user-2" });
    await settle();
    subscription.unsubscribe();

    expect(seen.map((requests) => requests.map((r) => r.cipherId))).toEqual([["cipher-1"], []]);
    expect(logService.error).toHaveBeenCalled();
  });

  it("reads nothing for a signed-out account", async () => {
    account$.next(null);

    expect(await firstValueFrom(service.requests$)).toEqual([]);
    expect(requestsApi.listMyAccessRequests).not.toHaveBeenCalled();
  });

  it("lets go of the access changes a task after the last subscriber leaves", async () => {
    const subscription = service.badges$.subscribe();
    await settle();
    subscription.unsubscribe();
    expect(accessChanged$.observed).toBe(true);

    await settle();

    expect(accessChanged$.observed).toBe(false);
  });
});
