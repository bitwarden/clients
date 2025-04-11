import { Observable, Subscription } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed to link to API
import type { DefaultNotificationsService } from "./internal";

/**
 * A service offering abilities to interact with push notifications from the server.
 */
export abstract class NotificationsService {
  /**
   * @deprecated This method should not be consumed, an observable to listen to server
   * notifications will be available one day but it is not ready to be consumed generally.
   * Please add code reacting to notifications in {@link DefaultNotificationsService.processNotification}
   */
  abstract notifications$: Observable<readonly [NotificationResponse, UserId]>;
  /**
   * Starts automatic listening and processing of notifications, should only be called once per application,
   * or you will risk notifications being processed multiple times.
   */
  abstract startListening(): Subscription;
  // TODO: Delete this method in favor of an `ActivityService` that notifications can depend on.
  // https://bitwarden.atlassian.net/browse/PM-14264
  abstract reconnectFromActivity(): void;
  // TODO: Delete this method in favor of an `ActivityService` that notifications can depend on.
  // https://bitwarden.atlassian.net/browse/PM-14264
  abstract disconnectFromInactivity(): void;
}
