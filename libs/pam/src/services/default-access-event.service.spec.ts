import { mock } from "jest-mock-extended";
import { Observable, Subject } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEvent, AccessEventKind } from "../abstractions/access-event";

import { DefaultAccessEventService } from "./default-access-event.service";

type Tuple = readonly [NotificationResponse, UserId];

function pushNotification(payload: Record<string, unknown> | null): NotificationResponse {
  // The service reads only `notification.payload`. The real constructor can't
  // produce a raw leasing payload anyway — leasing has no allocated
  // NotificationType, so the constructor's switch leaves `payload` undefined —
  // so we mock the response and supply just the field under test.
  const notification = mock<NotificationResponse>();
  notification.payload = payload;
  return notification;
}

const USER: UserId = "user-1" as UserId;

describe("DefaultAccessEventService", () => {
  let upstream$: Subject<Tuple>;
  let service: DefaultAccessEventService;

  beforeEach(() => {
    upstream$ = new Subject<Tuple>();
    service = new DefaultAccessEventService(upstream$.asObservable());
  });

  it("emits an approved event for a lease_approved push matching the request id", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: AccessEventKind.Approved, requestId: "req-1" }]);
  });

  it("emits a denied event for a lease_denied push matching the request id", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_denied", requestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: AccessEventKind.Denied, requestId: "req-1" }]);
  });

  it("accepts PascalCase payload keys (raw API casing)", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ Kind: "lease_approved", RequestId: "req-1" }), USER]);

    expect(received).toEqual([{ kind: AccessEventKind.Approved, requestId: "req-1" }]);
  });

  it("does not emit for pushes targeting a different request id", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-2" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with unknown kinds", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_revoked", requestId: "req-1" }), USER]);
    upstream$.next([pushNotification({ kind: undefined, requestId: "req-1" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with missing or empty request id", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "" }), USER]);
    upstream$.next([pushNotification({ kind: "lease_approved" }), USER]);

    expect(received).toEqual([]);
  });

  it("ignores pushes with a null payload", () => {
    const received: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => received.push(e));

    upstream$.next([pushNotification(null), USER]);

    expect(received).toEqual([]);
  });

  it("delivers the same event to multiple subscribers watching the same request id", () => {
    const a: AccessEvent[] = [];
    const b: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => a.push(e));
    service.events$("req-1").subscribe((e) => b.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);

    expect(a).toEqual([{ kind: AccessEventKind.Approved, requestId: "req-1" }]);
    expect(b).toEqual([{ kind: AccessEventKind.Approved, requestId: "req-1" }]);
  });

  it("shares a single upstream subscription across multiple per-request consumers", () => {
    let subscriptions = 0;
    const counted$ = new Observable<Tuple>((subscriber) => {
      subscriptions++;
      const sub = upstream$.subscribe(subscriber);
      return () => sub.unsubscribe();
    });
    const shared = new DefaultAccessEventService(counted$);

    shared.events$("req-1").subscribe();
    shared.events$("req-1").subscribe();
    shared.events$("req-2").subscribe();

    expect(subscriptions).toBe(1);
  });

  it("routes events to the correct per-request subscriber when multiple ids are watched", () => {
    const a: AccessEvent[] = [];
    const b: AccessEvent[] = [];
    service.events$("req-1").subscribe((e) => a.push(e));
    service.events$("req-2").subscribe((e) => b.push(e));

    upstream$.next([pushNotification({ kind: "lease_approved", requestId: "req-1" }), USER]);
    upstream$.next([pushNotification({ kind: "lease_denied", requestId: "req-2" }), USER]);

    expect(a).toEqual([{ kind: AccessEventKind.Approved, requestId: "req-1" }]);
    expect(b).toEqual([{ kind: AccessEventKind.Denied, requestId: "req-2" }]);
  });
});
