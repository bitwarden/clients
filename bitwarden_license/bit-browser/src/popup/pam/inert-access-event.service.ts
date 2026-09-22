import { EMPTY, Observable } from "rxjs";

import { AccessEventService } from "@bitwarden/bit-common/pam";

/**
 * An {@link AccessEventService} that never ticks.
 *
 * The popup's `ServerNotificationsService.notifications$` completes without emitting (pushes are
 * received in the background), and nothing relays the PAM push types to the foreground yet, so a
 * `DefaultAccessEventService` built over it could never fire and would log a warning per
 * subscription. Replace this with a stream fed from the background once that relay exists.
 */
export class InertAccessEventService implements AccessEventService {
  accessChanged$(): Observable<void> {
    return EMPTY;
  }

  approverInboxChanged$(): Observable<void> {
    return EMPTY;
  }
}
