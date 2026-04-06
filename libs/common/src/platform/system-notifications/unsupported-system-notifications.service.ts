import { throwError } from "rxjs";

import {
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationsService,
} from "./system-notifications.service";

export class UnsupportedSystemNotificationsService implements SystemNotificationsService {
  notificationClicked$ = throwError(() => new Error("Notification clicked is not supported."));

  async create(createInfo: SystemNotificationCreateInfo): Promise<string> {
    throw new Error("Create OS Notification unsupported.");
  }

  clear(clearInfo: SystemNotificationClearInfo): Promise<undefined> {
    throw new Error("Clear OS Notification unsupported.");
  }

  isSupported(): boolean {
    return false;
  }
}
