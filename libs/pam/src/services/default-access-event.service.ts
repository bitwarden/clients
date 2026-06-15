import { filter, map, Observable, share } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService } from "../abstractions/access-event.service";

/**
 * Default {@link AccessEventService} implementation.
 *
 * Subscribes once to the application-wide server-notifications stream, keeps
 * only {@link NotificationType.RefreshAccessRequest} pushes — the requester-scoped
 * lease-lifecycle signal the server fires on decide / activate / revoke / extend /
 * cancel — and shares the resulting hot tick so multiple consumers do not multiply
 * upstream work.
 *
 * The upstream observable (constructed by `DefaultServerNotificationsService`)
 * already handles transport selection (WebPush / SignalR), reconnect, and
 * activity-based disconnects. This service adds no buffering: ticks that arrive
 * while no one is subscribed are dropped, matching the rest of the Bitwarden
 * push surface. The push deliberately carries no vault data — it is purely a
 * "re-fetch your access state" signal — so this service emits `void`.
 */
export class DefaultAccessEventService implements AccessEventService {
  private readonly changed$: Observable<void>;

  constructor(notifications$: Observable<readonly [NotificationResponse, UserId]>) {
    this.changed$ = notifications$.pipe(
      filter(([notification]) => notification?.type === NotificationType.RefreshAccessRequest),
      map((): void => undefined),
      // Single upstream subscription shared across all consumers. `share()` (no
      // replay) matches the fire-and-forget semantics of the push channel.
      share(),
    );
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }
}
