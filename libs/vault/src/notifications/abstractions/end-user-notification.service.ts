import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { NotificationView } from "../models";

/**
 * A service for retrieving and managing notifications for end users.
 */
export abstract class EndUserNotificationService {
  abstract fetchNotificationsFromApi(userId: UserId): Promise<any>;
  /**
   * Observable of all notifications for the given user.
   * @param userId
   */
  abstract notifications$(userId: UserId): Observable<NotificationView[]>;

  /**
   * Observable of all unread notifications for the given user.
   * @param userId
   */
  abstract unreadNotifications$(userId: UserId): Observable<NotificationView[]>;

  /**
   * Mark a notification as read.
   * @param notificationId
   */
  abstract markAsRead(notificationId: any): Promise<void>;

  /**
   * Mark a notification as deleted.
   * @param notificationId
   */
  abstract markAsDeleted(notificationId: any): Promise<void>;

  /**
   * Create/update a notification in the state for the user specified within the notification.
   * @remarks This method should only be called when a notification payload is received from the web socket.
   * @param notification
   */
  abstract upsert(notification: Notification): Promise<void>;

  /**
   * Clear all notifications from state for the given user.
   * @param userId
   */
  abstract clearState(userId: UserId): Promise<void>;
}
