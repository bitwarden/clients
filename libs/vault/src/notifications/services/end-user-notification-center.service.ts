import { Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { filterOutNullish } from "../../utils/observable-utilities";
import { EndUserNotificationService } from "../abstractions/end-user-notification.service";
import { NotificationView, NotificationViewData, NotificationViewResponse } from "../models";
import { NOTIFICATIONS } from "../state/end-user-notification.state";

/**
 * A service for retrieving and managing notifications for end users.
 */
@Injectable()
export class EndUserNotificationCenterService implements EndUserNotificationService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
  ) {}

  notifications$(userId: UserId): Observable<NotificationView[]> {
    return this.notificationState(userId).state$.pipe(
      switchMap(async (notifications) => {
        // NOTE: Must update this later so the fetch is not called repeatedly should the user have zero notifications
        if (notifications == null || notifications.length === 0) {
          await this.fetchNotificationsFromApi(userId);
        }
        return notifications;
      }),
      filterOutNullish(),
      map((notifications) =>
        notifications.map((notification) => new NotificationView(notification)),
      ),
    );
  }

  unreadNotifications$(userId: UserId): Observable<NotificationView[]> {
    // We can target the unread notifications by NotificationView.readDate
    return of([]);
  }

  markAsRead(notificationId: any): any {
    // We can target the unread notifications by NotificationView.readDate
  }

  markAsDeleted(notificationId: any): any {}

  upsert(notification: Notification): any {}

  async clearState(userId: UserId): Promise<void> {
    await this.updateNotificationState(userId, []);
  }

  async getNotifications(userId: UserId) {
    return await this.fetchNotificationsFromApi(userId);
  }

  /**
   * Fetches the notifications from the API and updates the local state
   * @param userId
   * @private
   */
  async fetchNotificationsFromApi(userId: UserId): Promise<void> {
    const res = await this.apiService.send("GET", "/notifications", null, true, true);
    const response = new ListResponse(res, NotificationViewResponse);
    const notificationData = response.data.map((n) => new NotificationView(n));
    await this.updateNotificationState(userId, notificationData);
  }

  /**
   * Updates the local state with notifications and returns the updated state
   * @param userId
   * @param tasks
   * @private
   */
  private updateNotificationState(
    userId: UserId,
    notifications: NotificationViewData[],
  ): Promise<NotificationViewData[] | null> {
    return this.notificationState(userId).update(() => notifications);
  }

  /**
   * Returns the local state for notifications
   * @param userId
   * @private
   */
  private notificationState(userId: UserId) {
    return this.stateProvider.getUser(userId, NOTIFICATIONS);
  }
}
