import { Observable, Subject, Subscription } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";

import { LogService } from "../../abstractions/log.service";
import { ServerNotificationsService } from "../server-notifications.service";

export class NoopServerNotificationsService implements ServerNotificationsService {
  notifications$: Observable<readonly [NotificationResponse, UserId]> = new Subject();

  constructor(private logService: LogService) {}

  startListening(): Subscription {
    this.logService.info(
      "Initializing no-op notification service, no push server notifications will be received",
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
