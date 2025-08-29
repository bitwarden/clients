import { map, merge, Observable } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
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

  constructor(private readonly platformUtilsService: PlatformUtilsService) {
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
      const deviceType: DeviceType = this.platformUtilsService.getDevice();

      const options: chrome.notifications.NotificationOptions<true> = {
        iconUrl: chrome.runtime.getURL("images/icon128.png"),
        message: createInfo.body,
        type: "basic",
        title: createInfo.title,
        buttons: createInfo.buttons.map((value) => ({ title: value.title })),
      };

      // Firefox notification api does not support buttons.
      if (deviceType === DeviceType.FirefoxExtension) {
        delete options.buttons;
      }

      if (createInfo.id != null) {
        chrome.notifications.create(createInfo.id, options, (notificationId) =>
          resolve(notificationId),
        );
      } else {
        chrome.notifications.create(options, (notificationId) => resolve(notificationId));
      }
    });
  }

  async clear(clearInfo: SystemNotificationClearInfo): Promise<undefined> {
    chrome.notifications.clear(clearInfo.id);
  }

  isSupported(): boolean {
    return "notifications" in chrome;
  }
}
