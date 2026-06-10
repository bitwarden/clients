import { filter, map, Observable, share } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEvent, AccessEventKind } from "../abstractions/access-event";
import { AccessEventService } from "../abstractions/access-event.service";

/**
 * Discriminator strings emitted by the server in the push payload's `kind`
 * field. These match the wire contract documented in PM-37262 (server-side
 * tracking ticket TBD).
 *
 * We match on the payload discriminator rather than on a numeric
 * `NotificationType` because the backend has not yet allocated push
 * notification type ids for leasing — see follow-up note in this file.
 */
const APPROVED_KIND = "lease_approved";
const DENIED_KIND = "lease_denied";

type RawLeasePushPayload = {
  kind?: string;
  Kind?: string;
  requestId?: string;
  RequestId?: string;
};

/**
 * Default {@link AccessEventService} implementation.
 *
 * Subscribes to the application-wide server-notifications stream once, filters
 * for lease-lifecycle push payloads, and shares the resulting hot observable
 * so that multiple per-request subscribers do not multiply upstream work.
 *
 * The upstream observable (constructed by `DefaultServerNotificationsService`)
 * already handles transport selection (WebPush / SignalR), reconnect, and
 * activity-based disconnects. This service does not add buffering — events
 * that arrive while no one is subscribed are dropped on the floor, matching
 * the rest of the Bitwarden push surface.
 *
 * TODO: once the backend allocates dedicated `NotificationType` ids for the
 * lease lifecycle, this service should additionally gate on `notification.type`
 * before reading the payload. The payload-discriminator check is intentionally
 * defensive in the meantime — it both forward-compats with the eventual typed
 * payloads and refuses to react to unrelated push messages that happen to
 * carry a `requestId`.
 */
export class DefaultAccessEventService implements AccessEventService {
  private readonly accessEvents$: Observable<AccessEvent>;

  constructor(notifications$: Observable<readonly [NotificationResponse, UserId]>) {
    this.accessEvents$ = notifications$.pipe(
      map(([notification]) => this.toLeaseEvent(notification)),
      filter((event): event is AccessEvent => event != null),
      // Single upstream subscription shared across all per-request filters.
      // `share()` (no replay) matches the fire-and-forget semantics of the
      // underlying push channel.
      share(),
    );
  }

  events$(requestId: string): Observable<AccessEvent> {
    return this.accessEvents$.pipe(filter((event) => event.requestId === requestId));
  }

  allEvents$(): Observable<AccessEvent> {
    return this.accessEvents$;
  }

  private toLeaseEvent(notification: NotificationResponse): AccessEvent | null {
    const payload = notification?.payload as RawLeasePushPayload | undefined;
    if (payload == null) {
      return null;
    }

    const kind = payload.kind ?? payload.Kind;
    const requestId = payload.requestId ?? payload.RequestId;
    if (typeof requestId !== "string" || requestId.length === 0) {
      return null;
    }

    switch (kind) {
      case APPROVED_KIND:
        return { kind: AccessEventKind.Approved, requestId };
      case DENIED_KIND:
        return { kind: AccessEventKind.Denied, requestId };
      default:
        return null;
    }
  }
}
