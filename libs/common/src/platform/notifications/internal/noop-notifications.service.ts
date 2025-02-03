import { Subscription } from "rxjs";

import { LogService } from "../../abstractions/log.service";
import { NotificationsService } from "../notifications.service";

export class NoopNotificationsService implements NotificationsService {
  constructor(private logService: LogService) {}

  startListening(): Subscription {
    this.logService.info(
      "Initializing no-op notification service, no push notifications will be received",
    );
    return Subscription.EMPTY;
  }

  reconnectFromActivity(): void {
    this.logService.info("Reconnecting notification service from activity");
  }

  disconnectFromInactivity(): void {
    this.logService.info("Disconnecting notification service from inactivity");
  }
}
