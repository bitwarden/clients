import { Subscription } from "rxjs";

import { NotificationsService } from "@bitwarden/common/platform/notifications";

/**
 * An instance of {@link NotificationsService} that throws if it is called at all. It is currently
 * not invoked in any way from the foreground but this immortilizes calls into it as an error
 * vs the current behavior that it could start a second notifications service connection.
 *
 * In the future, the `notifications$` property can be exposed and WOULD be allowed to be called,
 * this instance would then connect up a port or message stream from the background. This requires that
 * all notifications would need to be deserializable.
 */
export class ForegroundNotificationsService implements NotificationsService {
  start(): Subscription {
    throw new Error(
      "NotificationsService should only ever be interacted with in browser background.",
    );
  }

  reconnectFromActivity(): void {
    throw new Error(
      "NotificationsService should only ever be interacted with in browser background.",
    );
  }

  disconnectFromInactivity(): void {
    throw new Error(
      "NotificationsService should only ever be interacted with in browser background.",
    );
  }
}
