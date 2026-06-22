import { mock } from "jest-mock-extended";
import { Observable, Subject } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultAccessEventService } from "./default-access-event.service";

type Tuple = readonly [NotificationResponse, UserId];

function push(type: NotificationType): NotificationResponse {
  // The service reads only `notification.type`; other fields are irrelevant.
  const notification = mock<NotificationResponse>();
  notification.type = type;
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

  it("emits a tick for a RefreshAccessRequest push", () => {
    let ticks = 0;
    service.accessChanged$().subscribe(() => ticks++);

    upstream$.next([push(NotificationType.RefreshAccessRequest), USER]);

    expect(ticks).toBe(1);
  });

  it("ignores the approver-inbox push (that signal is consumed elsewhere)", () => {
    let ticks = 0;
    service.accessChanged$().subscribe(() => ticks++);

    upstream$.next([push(NotificationType.RefreshApproverInbox), USER]);

    expect(ticks).toBe(0);
  });

  it("ignores unrelated push types", () => {
    let ticks = 0;
    service.accessChanged$().subscribe(() => ticks++);

    upstream$.next([push(NotificationType.SyncCipherUpdate), USER]);
    upstream$.next([push(NotificationType.AuthRequest), USER]);

    expect(ticks).toBe(0);
  });

  it("delivers the same tick to multiple subscribers", () => {
    let a = 0;
    let b = 0;
    service.accessChanged$().subscribe(() => a++);
    service.accessChanged$().subscribe(() => b++);

    upstream$.next([push(NotificationType.RefreshAccessRequest), USER]);

    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("shares a single upstream subscription across consumers", () => {
    let subscriptions = 0;
    const counted$ = new Observable<Tuple>((subscriber) => {
      subscriptions++;
      const sub = upstream$.subscribe(subscriber);
      return () => sub.unsubscribe();
    });
    const shared = new DefaultAccessEventService(counted$);

    shared.accessChanged$().subscribe();
    shared.accessChanged$().subscribe();

    expect(subscriptions).toBe(1);
  });
});
