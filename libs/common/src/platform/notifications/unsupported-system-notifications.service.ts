import { Subject, throwError } from "rxjs";

import {
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "./system-notifications-service";

export class UnsupportedSystemNotificationsService implements SystemNotificationsService {
  private systemNotificationClickedSubject = new Subject<SystemNotificationEvent>();
  notificationClicked$ = throwError(() => new Error("Notification clicked is not supported."));

  async create(createInfo: SystemNotificationCreateInfo): Promise<undefined> {
    throw new Error("Create OS Notification unsupported.");
  }

  clear(clearInfo: SystemNotificationClearInfo): undefined {
    throw new Error("Clear OS Notification unsupported.");
  }

  isSupported(): boolean {
    return false;
  }
}
