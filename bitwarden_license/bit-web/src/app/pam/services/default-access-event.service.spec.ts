import { Subject, Subscription } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultAccessEventService } from "./default-access-event.service";

type Emission = readonly [NotificationResponse, UserId];

const USER_ID = "user-1" as UserId;

function notification(type: NotificationType): Emission {
  return [{ type } as NotificationResponse, USER_ID];
}

describe("DefaultAccessEventService", () => {
  let notifications$: Subject<Emission>;
  let service: DefaultAccessEventService;
  const subscriptions: Subscription[] = [];

  function watch(): () => number {
    let count = 0;
    subscriptions.push(service.accessChanged$().subscribe(() => (count += 1)));
    return () => count;
  }

  function watchInbox(): () => number {
    let count = 0;
    subscriptions.push(service.approverInboxChanged$().subscribe(() => (count += 1)));
    return () => count;
  }

  beforeEach(() => {
    notifications$ = new Subject<Emission>();
    service = new DefaultAccessEventService(notifications$);
  });

  afterEach(() => {
    subscriptions.forEach((s) => s.unsubscribe());
    subscriptions.length = 0;
  });

  it("ticks on a RefreshAccessRequest push", () => {
    const ticks = watch();

    notifications$.next(notification(NotificationType.RefreshAccessRequest));

    expect(ticks()).toBe(1);
  });

  it("ignores every other notification type", () => {
    const ticks = watch();

    notifications$.next(notification(NotificationType.SyncCipherUpdate));
    notifications$.next(notification(NotificationType.RefreshSecurityTasks));
    notifications$.next(notification(NotificationType.LogOut));

    expect(ticks()).toBe(0);
  });

  it("ticks on a RefreshApproverInbox push", () => {
    const ticks = watchInbox();

    notifications$.next(notification(NotificationType.RefreshApproverInbox));

    expect(ticks()).toBe(1);
  });

  it("keeps the two pushes on separate streams", () => {
    // The approver push says a managed collection changed, which is no reason for the
    // requester-side surfaces to re-read — and vice versa.
    const ticks = watch();
    const inboxTicks = watchInbox();

    notifications$.next(notification(NotificationType.RefreshApproverInbox));
    expect(ticks()).toBe(0);
    expect(inboxTicks()).toBe(1);

    notifications$.next(notification(NotificationType.RefreshAccessRequest));
    expect(ticks()).toBe(1);
    expect(inboxTicks()).toBe(1);
  });

  it("emits void — the push carries no vault data to pass on", () => {
    const seen: unknown[] = [];
    subscriptions.push(service.accessChanged$().subscribe((value) => seen.push(value)));

    notifications$.next(notification(NotificationType.RefreshAccessRequest));

    expect(seen).toEqual([undefined]);
  });

  it("survives a malformed notification without tearing the stream down", () => {
    const ticks = watch();

    notifications$.next([undefined as unknown as NotificationResponse, USER_ID]);
    notifications$.next(notification(NotificationType.RefreshAccessRequest));

    expect(ticks()).toBe(1);
  });

  it("takes one upstream subscription however many consumers there are", () => {
    // share() — several surfaces watching must not multiply work on the push channel.
    let upstreamSubscribes = 0;
    const counted$ = new Subject<Emission>();
    const tracked = new DefaultAccessEventService(
      new Proxy(counted$, {
        get(target, prop) {
          if (prop === "subscribe") {
            upstreamSubscribes += 1;
          }
          return Reflect.get(target, prop, target);
        },
      }) as unknown as Subject<Emission>,
    );

    subscriptions.push(tracked.accessChanged$().subscribe());
    subscriptions.push(tracked.accessChanged$().subscribe());
    subscriptions.push(tracked.accessChanged$().subscribe());

    expect(upstreamSubscribes).toBe(1);
  });

  it("does not replay a push that fired before subscribing", () => {
    notifications$.next(notification(NotificationType.RefreshAccessRequest));

    const ticks = watch();

    expect(ticks()).toBe(0);
  });
});
