import { Subscription } from "rxjs";

import { LogService } from "../abstractions/log.service";
import { NotificationsService as NotificationsServiceAbstraction } from "../notifications/notifications.service";

export class NoopNotificationsService implements NotificationsServiceAbstraction {
  constructor(private logService: LogService) {}

  start(): Subscription {
    this.logService.info(
      "Starting no-op notification service, no push notifications will be received",
    );
    return Subscription.EMPTY;
  }

  reconnectFromActivity() {
    this.logService.info("Reconnecting notification service from activity");
  }

  disconnectFromInactivity() {
    this.logService.info("Disconnecting notification service from inactivity");
  }
}
