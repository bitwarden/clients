import { concatMap, EMPTY, filter, map, Observable, Subscription, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { NotificationId, UserId } from "@bitwarden/common/types/guid";
import {
  filterOutNullish,
  perUserCache$,
} from "@bitwarden/common/vault/utils/observable-utilities";

import { EndUserNotificationService } from "../abstractions/end-user-notification.service";
import { NotificationView, NotificationViewData, NotificationViewResponse } from "../models";
import { NOTIFICATIONS } from "../state/end-user-notification.state";

/**
 * The default number of notifications to fetch from the API.
 */
export const DEFAULT_NOTIFICATION_PAGE_SIZE = 50;

const getLoggedInUserIds = map<Record<UserId, AuthenticationStatus>, UserId[]>((authStatuses) =>
  Object.entries(authStatuses ?? {})
    .filter(([, status]) => status >= AuthenticationStatus.Locked)
    .map(([userId]) => userId as UserId),
);

/**
 * A service for retrieving and managing notifications for end users.
 */
export class DefaultEndUserNotificationService implements EndUserNotificationService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
    private notificationService: ServerNotificationsService,
    private authService: AuthService,
    private logService: LogService,
  ) {}

  notifications$ = perUserCache$((userId: UserId): Observable<NotificationView[]> => {
    return this.notificationState(userId).state$.pipe(
      switchMap(async (notifications) => {
        if (notifications == null) {
          await this.fetchNotificationsFromApi(userId);
          return null;
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

  async markAsRead(notificationId: NotificationId, userId: UserId): Promise<void> {
    await this.apiService.send("PATCH", `/notifications/${notificationId}/read`, null, true, false);
    await this.notificationState(userId).update((current) => {
      const notification = current?.find((n) => n.id === notificationId);
      if (notification) {
        notification.readDate = new Date();
      }
      return current;
    });
  }

  async markAsDeleted(notificationId: NotificationId, userId: UserId): Promise<void> {
    await this.apiService.send(
      "DELETE",
      `/notifications/${notificationId}/delete`,
      null,
      true,
      false,
    );
    await this.notificationState(userId).update((current) => {
      const notification = current?.find((n) => n.id === notificationId);
      if (notification) {
        notification.deletedDate = new Date();
      }
      return current;
    });
  }

  async clearState(userId: UserId): Promise<void> {
    await this.replaceNotificationState(userId, []);
  }

  async refreshNotifications(userId: UserId) {
    await this.fetchNotificationsFromApi(userId);
  }

  /**
   * Helper observable to filter notifications by the notification type and user ids
   * Returns EMPTY if no user ids are provided
   * @param userIds
   * @private
   */
  private filteredEndUserNotifications$(userIds: UserId[]) {
    if (userIds.length == 0) {
      return EMPTY;
    }

    return this.notificationService.notifications$.pipe(
      filter(
        ([{ type }, userId]) =>
          (type === NotificationType.Notification ||
            type === NotificationType.NotificationStatus) &&
          userIds.includes(userId),
      ),
    );
  }

  /**
   * Creates a subscription to listen for end user push notifications and notification status updates.
   */
  listenForEndUserNotifications(): Subscription {
    return this.authService.authStatuses$
      .pipe(
        getLoggedInUserIds,
        switchMap((userIds) => this.filteredEndUserNotifications$(userIds)),
        concatMap(([notification, userId]) =>
          this.upsertNotification(
            userId,
            new NotificationViewData(notification.payload as NotificationViewResponse),
          ),
        ),
      )
      .subscribe();
  }

  /**
   * Fetches the notifications from the API and updates the local state
   * @param userId
   * @private
   */
  private async fetchNotificationsFromApi(userId: UserId): Promise<void> {
    const res = await this.apiService.send(
      "GET",
      `/notifications?pageSize=${DEFAULT_NOTIFICATION_PAGE_SIZE}`,
      null,
      true,
      true,
    );
    const response = new ListResponse(res, NotificationViewResponse);

    if (response.continuationToken != null) {
      this.logService.warning(
        `More notifications available, but not fetched. Consider increasing the page size from ${DEFAULT_NOTIFICATION_PAGE_SIZE}`,
      );
    }

    const notificationData = response.data.map((n) => new NotificationViewData(n));
    await this.replaceNotificationState(userId, notificationData);
  }

  /**
   * Replaces the local state with notifications and returns the updated state
   * @param userId
   * @param notifications
   * @private
   */
  private replaceNotificationState(
    userId: UserId,
    notifications: NotificationViewData[],
  ): Promise<NotificationViewData[] | null> {
    return this.notificationState(userId).update(() => notifications);
  }

  /**
   * Updates the local state adding the new notification or updates an existing one with the same id
   * Returns the entire updated notifications state
   * @param userId
   * @param notification
   * @private
   */
  private async upsertNotification(
    userId: UserId,
    notification: NotificationViewData,
  ): Promise<NotificationViewData[] | null> {
    return this.notificationState(userId).update((current) => {
      current ??= [];

      const existingIndex = current.findIndex((n) => n.id === notification.id);

      if (existingIndex === -1) {
        current.push(notification);
      } else {
        current[existingIndex] = notification;
      }

      return current;
    });
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
