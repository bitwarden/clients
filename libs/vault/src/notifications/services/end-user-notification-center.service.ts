import { Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { filterOutNullish } from "../../utils/observable-utilities";
import { EndUserNotificationService } from "../abstractions/end-user-notification.service";
import { NotificationView } from "../models";
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
  }

  unreadNotifications$(userId: UserId): Observable<NotificationView[]> {
    return of([]);
    // return this.notificationState(userId).state$.pipe(
    //   filter((notifications   ) => {
    //     return notifications;
    //   }),
    //   filterOutNullish(),
    //   map((notifications) => notifications.map((notification  ) => new NotificationView(notification))),
    // );
  }

  markAsRead(notificationId: any): any {}

  markAsDeleted(notificationId: any): any {}

  upsert(notification: Notification): any {}

  clearState(userId: UserId): any {}

  async getNotifications(userId: UserId) {
    return await this.fetchNotificationsFromApi(userId);
  }

  private notificationState(userId: UserId) {
    return this.stateProvider.getUser(userId, NOTIFICATIONS);
  }

  async fetchNotificationsFromApi(userId: UserId): Promise<void> {
    return await this.apiService.send("GET", "/notifications", null, true, true);
  }
}
