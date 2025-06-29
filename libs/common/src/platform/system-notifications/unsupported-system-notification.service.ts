import { Observable, Subject } from "rxjs";

import {
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationEvent,
  SystemNotificationServiceAbstraction as SystemNotificationServiceAbstraction,
} from "@bitwarden/common/platform/system-notifications/system-notification-service";

export class UnsupportedSystemNotificationService implements SystemNotificationServiceAbstraction {
  private systemNotificationClickedSubject = new Subject<SystemNotificationEvent>();
  systemNotificationClicked$: Observable<SystemNotificationEvent>;

  constructor() {
    this.systemNotificationClicked$ = this.systemNotificationClickedSubject.asObservable();
  }

  async createOSNotification(createInfo: SystemNotificationCreateInfo): Promise<undefined> {
    throw new Error("Create OS Notification unsupported.");
  }

  clearOSNotification(clearInfo: SystemNotificationClearInfo): undefined {
    throw new Error("Clear OS Notification unsupported.");
  }

  isSupported(): boolean {
    return false;
  }
}
