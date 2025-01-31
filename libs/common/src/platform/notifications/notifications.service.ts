import { Subscription } from "rxjs";

/**
 * A service offering abilities to interact with push notifications from the server.
 */
export abstract class NotificationsService {
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
