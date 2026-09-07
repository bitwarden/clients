import { filter, map, Observable, share } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService } from "..";

/**
 * Default {@link AccessEventService}: filters the application-wide server-notification stream
 * down to the two PAM push types — `RefreshAccessRequest` for the requester,
 * `RefreshApproverInbox` for approvers — and shares each result.
 *
 * Takes the stream as a constructor argument, not the whole notifications service, so this
 * class has no opinion about transport and unit tests hand it a plain `Subject`.
 *
 * Reads `ServerNotificationsService.notifications$` directly rather than adding a case to
 * `DefaultServerNotificationsService.processNotification`, which would put a commercial PAM
 * concern in `libs/common` — the same precedent `DefaultTaskService` follows for
 * `RefreshSecurityTasks`.
 *
 * User scoping comes from upstream, so the `UserId` half of each emission is unused; `share()`
 * without replay matches the push channel's fire-and-forget semantics.
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
    // Kept separate from `changed$`: the approver push names a collection the caller manages,
    // not a reason for requester-side surfaces to re-read. Surfaces spanning both sides
    // subscribe to both.
    this.inboxChanged$ = ticksFor(NotificationType.RefreshApproverInbox);
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }

  approverInboxChanged$(): Observable<void> {
    return this.inboxChanged$;
  }
}
