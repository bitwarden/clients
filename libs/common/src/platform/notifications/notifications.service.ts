import { Subscription } from "rxjs";

import { NotificationResponse } from "../../models/response/notification.response";
import { UserId } from "../../types/guid";

export type Notification = {
  /**
   * The user id for which this notification corresponds to.
   */
  userId: UserId;

  /**
   * The data of the notification.
   */
  data: NotificationResponse;
};

export abstract class NotificationsService {
  /**
   * Legacy method to internally subscribe to and process notifications.
   * @returns A subscription that can be unsubscribed to and have notificatons processing stopped.
   */
  abstract start(): Subscription;

  /**
   * A method to call when the user has become active at their computer
   * and indicating that the notifications service should resume connection.
   */
  abstract reconnectFromActivity(): void;

  /**
   * A method to call when the user has become inactive at their computer
   * and indicating that the notifications service should pause the connection.
   */
  abstract disconnectFromInactivity(): void;
}
