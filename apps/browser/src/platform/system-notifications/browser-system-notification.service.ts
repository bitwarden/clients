import { map, merge, Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { DeviceType } from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonLocation,
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/notifications/system-notifications.service";

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

  async create(createInfo: SystemNotificationCreateInfo): Promise<string | undefined> {
    try {
      const notificationId = createInfo.id || uuidv4();
      const deviceType = this.platformUtilsService.getDevice();

      const notificationOptions: chrome.notifications.NotificationOptions<true> = {
        iconUrl: "https://avatars.githubusercontent.com/u/15990069?s=200",
        message: createInfo.body,
        type: "basic",
        title: createInfo.title,
        buttons: createInfo.buttons.map((value) => {
          return { title: value.title };
        }),
      };

      switch (deviceType) {
        case DeviceType.FirefoxExtension:
          // Firefox does not support buttons in notifications
          delete notificationOptions.buttons;
          break;
        default:
          break;
      }

      chrome.notifications.create(notificationId, notificationOptions);

      // eslint-disable-next-line no-restricted-syntax
      chrome.notifications.onButtonClicked.addListener(
        (notificationId: string, buttonIndex: number) => {
          this.notificationClicked$.subscribe({
            next: () => ({
              id: notificationId,
              buttonIdentifier: buttonIndex,
            }),
          });
        },
      );

      // eslint-disable-next-line no-restricted-syntax
      chrome.notifications.onClicked.addListener((notificationId: string) => {
        this.notificationClicked$.subscribe({
          next: () => ({
            id: notificationId,
            buttonIdentifier: ButtonLocation.NotificationButton,
          }),
        });
      });

      return notificationId;
    } catch (e) {
      this.logService.error(
        `Failed to create notification on ${this.platformUtilsService.getDevice()} with error: ${e}`,
      );
    }
  }

  async clear(clearInfo: SystemNotificationClearInfo): Promise<undefined> {
    chrome.notifications.clear(clearInfo.id);
  }

  isSupported(): boolean {
    return "notifications" in chrome;
  }
}
