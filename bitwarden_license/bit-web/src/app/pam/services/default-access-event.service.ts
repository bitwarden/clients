import { filter, map, Observable, share } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService } from "..";

/**
 * Default {@link AccessEventService}: filters the application-wide server-notification stream down to
 * the two PAM push types — `RefreshAccessRequest` for the requester and `RefreshApproverInbox` for
 * the approvers — and shares each result.
 *
 * Takes the stream as a constructor argument rather than the whole notifications service so this
 * class has no opinion about transport, and unit tests hand it a plain `Subject`.
 *
 * Reads `ServerNotificationsService.notifications$` directly. That member is marked deprecated in
 * favour of adding a case to `DefaultServerNotificationsService.processNotification`, but doing so
 * would put a commercial PAM concern in `libs/common`; `DefaultTaskService` filters the same stream
 * for `RefreshSecurityTasks` for the same reason, so this follows an established precedent rather
 * than inventing one.
 *
 * User scoping comes from upstream — the stream is already scoped to the active account — so the
 * `UserId` half of each emission is deliberately unused. `share()` without replay matches the
 * fire-and-forget semantics of the push channel.
 */
export class DefaultAccessEventService implements AccessEventService {
  private readonly changed$: Observable<void>;
  private readonly inboxChanged$: Observable<void>;

  constructor(notifications$: Observable<readonly [NotificationResponse, UserId]>) {
    const ticksFor = (type: NotificationType): Observable<void> =>
      notifications$.pipe(
        filter(([notification]) => notification?.type === type),
        map((): void => undefined),
        share(),
      );

    this.changed$ = ticksFor(NotificationType.RefreshAccessRequest);
    // Kept a separate stream rather than merged into `changed$`: the approver push says a collection
    // the caller manages changed, which is no reason for the requester-side surfaces (the lease
    // banner, a cipher's access state) to re-read. Surfaces that span both sides subscribe to both —
    // `ApproverInboxService` and the nav badge do.
    this.inboxChanged$ = ticksFor(NotificationType.RefreshApproverInbox);
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }

  approverInboxChanged$(): Observable<void> {
    return this.inboxChanged$;
  }
}
