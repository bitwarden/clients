import { Observable } from "rxjs";

// This is currently tailored for Chrome extension's api, if Safari works
// differently where clicking a notification button produces a different
// identifier we need to reconcile that here.
export const ButtonLocation = Object.freeze({
  FirstOptionalButton: 0, // this is the first optional button we can set
  SecondOptionalButton: 1, // this is the second optional button we can set
  NotificationButton: 2, // this is when you click the notification as a whole
});

export type ButtonLocationKeys = (typeof ButtonLocation)[keyof typeof ButtonLocation];

export type SystemNotificationsButton = {
  title: string;
};

export type SystemNotificationCreateInfo = {
  id?: string;
  title: string;
  body: string;
  buttons: SystemNotificationsButton[];
};

export type SystemNotificationClearInfo = {
  id: string;
};

export type SystemNotificationEvent = {
  id: string;
  buttonIdentifier: number;
};

/**
 * A service responsible for displaying operating system level server notifications.
 */
export abstract class SystemNotificationsService {
  abstract notificationClicked$: Observable<SystemNotificationEvent>;

  /**
   * Creates a notification.
   * @param createInfo
   * @returns If a notification is successfully created it will respond back with an
   *          id that refers to a notification.
   */
  abstract create(createInfo: SystemNotificationCreateInfo): Promise<string>;

  /**
   * Clears a notification.
   * @param clearInfo Any info needed required to clear a notification.
   */
  abstract clear(clearInfo: SystemNotificationClearInfo): Promise<void>;

  /**
   * Used to know if a given platform supports server notifications.
   */
  abstract isSupported(): boolean;
}
