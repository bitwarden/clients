import { Injectable } from "@angular/core";
import { concatMap, filter, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { NotificationType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { NotificationsService } from "@bitwarden/common/platform/notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import {
  filterOutNullish,
  perUserCache$,
} from "@bitwarden/common/vault/utils/observable-utilities";

import { EndUserNotificationService } from "../abstractions/end-user-notification.service";
import { NotificationView, NotificationViewData, NotificationViewResponse } from "../models";
import { NOTIFICATIONS } from "../state/end-user-notification.state";

/**
 * A service for retrieving and managing notifications for end users.
 */
@Injectable({
  providedIn: "root",
})
export class DefaultEndUserNotificationService implements EndUserNotificationService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
    private defaultNotifications: NotificationsService,
  ) {
    this.defaultNotifications.notifications$
      .pipe(
        filter(
          ([notification]) =>
            notification.type === NotificationType.Notification ||
            notification.type === NotificationType.NotificationStatus,
        ),
        concatMap(([notification, userId]) =>
          this.updateNotificationState(userId, [
            new NotificationViewData(notification.payload as NotificationViewResponse),
          ]),
        ),
      )
      .subscribe();
  }

  notifications$ = perUserCache$((userId: UserId): Observable<NotificationView[]> => {
    return this.notificationState(userId).state$.pipe(
      switchMap(async (notifications) => {
        if (notifications == null) {
          await this.fetchNotificationsFromApi(userId);
        }
        return notifications;
      }),
      filterOutNullish(),
      map((notifications) =>
        notifications.map((notification) => new NotificationView(notification)),
      ),
    );
  });

  unreadNotifications$ = perUserCache$((userId: UserId): Observable<NotificationView[]> => {
    return this.notifications$(userId).pipe(
      map((notifications) => notifications.filter((notification) => notification.readDate == null)),
    );
  });

  async markAsRead(notificationId: any, userId: UserId): Promise<void> {
    await this.apiService.send("PATCH", `/notifications/${notificationId}/read`, null, true, false);
    await this.getNotifications(userId);
  }

  async markAsDeleted(notificationId: any, userId: UserId): Promise<void> {
    await this.apiService.send(
      "DELETE",
      `/notifications/${notificationId}/delete`,
      null,
      true,
      false,
    );
    await this.getNotifications(userId);
  }

  async clearState(userId: UserId): Promise<void> {
    await this.updateNotificationState(userId, []);
  }

  async getNotifications(userId: UserId) {
    await this.fetchNotificationsFromApi(userId);
  }

  /**
   * Fetches the notifications from the API and updates the local state
   * @param userId
   * @private
   */
  private async fetchNotificationsFromApi(userId: UserId): Promise<void> {
    const res = await this.apiService.send("GET", "/notifications", null, true, true);
    const response = new ListResponse(res, NotificationViewResponse);
    const notificationData = response.data.map((n) => new NotificationView(n));
    await this.updateNotificationState(userId, notificationData);
  }

  /**
   * Updates the local state with notifications and returns the updated state
   * @param userId
   * @param notifications
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
