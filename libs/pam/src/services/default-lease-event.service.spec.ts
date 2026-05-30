import { Observable, Subject } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { LeaseEvent, LeaseEventKind } from "../abstractions/lease-event";

import { DefaultLeaseEventService } from "./default-lease-event.service";

type Tuple = readonly [NotificationResponse, UserId];

function pushNotification(payload: Record<string, unknown> | null): NotificationResponse {
  // The real NotificationResponse parses payloads via `getResponseProperty`;
  // for these tests we only care about the shape this service reads, so we
  // bypass the constructor's switch statement by injecting payload directly.
  const response = new NotificationResponse({});
  (response as unknown as { payload: unknown }).payload = payload;
  return response;
}

const USER: UserId = "user-1" as UserId;

describe("DefaultLeaseEventService", () => {
  let upstream$: Subject<Tuple>;
  let service: DefaultLeaseEventService;

  beforeEach(() => {
    upstream$ = new Subject<Tuple>();
    service = new DefaultLeaseEventService(upstream$.asObservable());
  });

  it("emits an approved event for a lease_approved push matching the request id", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: LeaseEventKind.Approved, requestId: "req-1" }]);
  });

  it("emits a denied event for a lease_denied push matching the request id", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_denied", requestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: LeaseEventKind.Denied, requestId: "req-1" }]);
  });

  it("accepts PascalCase payload keys (raw API casing)", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ Kind: "lease_approved", RequestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: LeaseEventKind.Approved, requestId: "req-1" }]);
  });

  it("does not emit for pushes targeting a different request id", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-2" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with unknown kinds", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_revoked", requestId: "req-1" }), USER]);
    upstream$.next([pushNotification({ kind: undefined, requestId: "req-1" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with missing or empty request id", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "" }), USER]);
    upstream$.next([pushNotification({ kind: "lease_approved" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with a null payload", () => {
    const received: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification(null), USER]);

    expect(received).toEqual([]);
  });

  it("delivers the same event to multiple subscribers watching the same request id", () => {
    const a: LeaseEvent[] = [];
    const b: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => a.push(e));
    service.events$("req-1").subscribe((e) => b.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);

    expect(a).toEqual([{ kind: LeaseEventKind.Approved, requestId: "req-1" }]);
    expect(b).toEqual([{ kind: LeaseEventKind.Approved, requestId: "req-1" }]);
  });

  it("shares a single upstream subscription across multiple per-request consumers", () => {
    let subscriptions = 0;
    const counted$ = new Observable<Tuple>((subscriber) => {
      subscriptions++;
      const sub = upstream$.subscribe(subscriber);
      return () => sub.unsubscribe();
    });
    const shared = new DefaultLeaseEventService(counted$);

    shared.events$("req-1").subscribe();
    shared.events$("req-1").subscribe();
    shared.events$("req-2").subscribe();

    expect(subscriptions).toBe(1);
  });

  it("routes events to the correct per-request subscriber when multiple ids are watched", () => {
    const a: LeaseEvent[] = [];
    const b: LeaseEvent[] = [];
    service.events$("req-1").subscribe((e) => a.push(e));
    service.events$("req-2").subscribe((e) => b.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);
    upstream$.next([pushNotification({ kind: "lease_denied", requestId: "req-2" }), USER]);

    expect(a).toEqual([{ kind: LeaseEventKind.Approved, requestId: "req-1" }]);
    expect(b).toEqual([{ kind: LeaseEventKind.Denied, requestId: "req-2" }]);
  });
});
