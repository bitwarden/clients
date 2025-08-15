import { map, merge, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonLocation,
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";

import { fromChromeEvent } from "../browser/from-chrome-event";

export class BrowserSystemNotificationService implements SystemNotificationsService {
  notificationClicked$: Observable<SystemNotificationEvent>;

  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.notificationClicked$ = merge(
      fromChromeEvent(chrome.notifications.onButtonClicked).pipe(
        map(([notificationId, buttonIndex]) => ({
          id: notificationId,
          buttonIdentifier: buttonIndex,
        })),
      ),
      fromChromeEvent(chrome.notifications.onClicked).pipe(
        map(([notificationId]: [string]) => ({
          id: notificationId,
          buttonIdentifier: ButtonLocation.NotificationButton,
        })),
      ),
    );
  }

  async create(createInfo: SystemNotificationCreateInfo): Promise<string> {
    return new Promise<string>((resolve) => {
      chrome.notifications.create(
        {
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          message: createInfo.body,
          type: "basic",
          title: createInfo.title,
          buttons: createInfo.buttons.map((value) => ({ title: value.title })),
        },
        (notificationId) => resolve(notificationId),
      );
    });
  }

  async clear(clearInfo: SystemNotificationClearInfo): Promise<undefined> {
    chrome.notifications.clear(clearInfo.id);
  }

  isSupported(): boolean {
    return "notifications" in chrome;
  }
}
