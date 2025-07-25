import { Observable, Subject } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonLocation,
  SystemNotificationClearInfo,
  SystemNotificationCreateInfo,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/notifications/system-notifications-service";

export class BrowserSystemNotificationService implements SystemNotificationsService {
  private systemNotificationClickedSubject = new Subject<SystemNotificationEvent>();
  notificationClicked$: Observable<SystemNotificationEvent>;

  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.notificationClicked$ = this.systemNotificationClickedSubject.asObservable();
  }

  async create(createInfo: SystemNotificationCreateInfo): Promise<undefined> {
    try {
      switch (this.platformUtilsService.getDevice()) {
        case DeviceType.ChromeExtension:
          chrome.notifications.create(createInfo.id, {
            iconUrl: "https://avatars.githubusercontent.com/u/15990069?s=200",
            message: createInfo.body,
            type: "basic",
            title: createInfo.title,
            buttons: createInfo.buttons.map((value) => {
              return { title: value.title };
            }),
          });

          // eslint-disable-next-line no-restricted-syntax
          chrome.notifications.onButtonClicked.addListener(
            (notificationId: string, buttonIndex: number) => {
              this.systemNotificationClickedSubject.next({
                id: notificationId,
                type: createInfo.type,
                buttonIdentifier: buttonIndex,
              });
            },
          );

          // eslint-disable-next-line no-restricted-syntax
          chrome.notifications.onClicked.addListener((notificationId: string) => {
            this.systemNotificationClickedSubject.next({
              id: notificationId,
              type: createInfo.type,
              buttonIdentifier: ButtonLocation.NotificationButton,
            });
          });

          break;
        case DeviceType.FirefoxExtension:
          await browser.notifications.create(createInfo.id, {
            iconUrl: "https://avatars.githubusercontent.com/u/15990069?s=200",
            message: createInfo.title,
            type: "basic",
            title: createInfo.title,
          });

          browser.notifications.onButtonClicked.addListener(
            (notificationId: string, buttonIndex: number) => {
              this.systemNotificationClickedSubject.next({
                id: notificationId,
                type: createInfo.type,
                buttonIdentifier: buttonIndex,
              });
            },
          );

          browser.notifications.onClicked.addListener((notificationId: string) => {
            this.systemNotificationClickedSubject.next({
              id: notificationId,
              type: createInfo.type,
              buttonIdentifier: ButtonLocation.NotificationButton,
            });
          });
      }
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
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.EdgeExtension:
      case DeviceType.VivaldiExtension:
      case DeviceType.OperaExtension:
      case DeviceType.ChromeExtension:
        return true;
      case DeviceType.FirefoxExtension:
        return false;
      default:
        return false;
    }
  }
}
