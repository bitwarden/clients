import { Observable, Subscription } from "rxjs";

import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { NotificationsService } from "@bitwarden/common/platform/notifications";
import { UserId } from "@bitwarden/common/types/guid";

// Eventually if we want to support listening to notifications from browser foreground we
// will only ever create a single SignalR connection, likely messaging to the background to reuse its connection.
export class ForegroundNotificationsService implements NotificationsService {
  notifications$: Observable<readonly [NotificationResponse, UserId]>;

  constructor(private readonly logService: LogService) {
    this.notifications$ = new Observable((subscriber) => {
      this.logService.warning(
        "Notifications will never emit from browser foreground, you will need to listen to messages from `DefaultNotificationsService.processNotification`",
      );
      subscriber.complete();
    });
  }

  startListening(): Subscription {
    throw new Error("startListening should never be called from browser foreground.");
  }
  reconnectFromActivity(): void {
    throw new Error("Activity should not be managed from browser foreground.");
  }
  disconnectFromInactivity(): void {
    throw new Error("Activity should not be managed from browser foreground.");
  }
}
