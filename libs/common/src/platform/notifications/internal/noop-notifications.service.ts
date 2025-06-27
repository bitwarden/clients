import { Observable, Subject, Subscription } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { LogService } from "../../abstractions/log.service";
import { NotificationsService } from "../notifications.service";

export class NoopNotificationsService implements NotificationsService {
  notifications$: Observable<readonly [NotificationResponse, UserId]> = new Subject();

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
