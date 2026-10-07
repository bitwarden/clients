import { filter, map, Observable, share } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService } from "..";

/**
 * Reads `notifications$` directly rather than adding a `processNotification` case, which would put
 * a commercial concern in `libs/common`. User scoping comes from upstream.
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
    // Separate from `changed$`, so requester-side surfaces don't re-read on it; surfaces spanning
    // both sides subscribe to both.
    this.inboxChanged$ = ticksFor(NotificationType.RefreshApproverInbox);
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }

  approverInboxChanged$(): Observable<void> {
    return this.inboxChanged$;
  }
}
