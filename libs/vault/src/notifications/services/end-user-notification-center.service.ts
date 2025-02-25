import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserId } from "@bitwarden/common/types/guid";

import { EndUserNotificationService } from "../abstractions/end-user-notification.service";
import { NotificationView } from "../models";

/**
 * A service for retrieving and managing notifications for end users.
 */
@Injectable()
export abstract class EndUserNotificationCenterService implements EndUserNotificationService {
  constructor(private apiService: ApiService) {}

  notifications$(userId: UserId): Observable<NotificationView[]> {
    return of([]);
  }

  unreadNotifications$(userId: UserId): Observable<NotificationView[]> {
    return of([]);
  }

  markAsRead(notificationId: any): any {}

  markAsDeleted(notificationId: any): any {}

  upsert(notification: Notification): any {}

  clearState(userId: UserId): any {}

  async getNotifications(userId: UserId) {
    return await this.fetchNotificationsFromApi(userId);
  }

  private async fetchNotificationsFromApi(userId: UserId): Promise<void> {
    return await this.apiService.send("GET", "/notifications", null, true, true);
  }
}
