import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  Observable,
  share,
  switchMap,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { AuthRequestAnsweringServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { trackedMerge } from "@bitwarden/common/platform/misc";

import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { NotificationType } from "../../../enums";
import {
  NotificationResponse,
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { AppIdService } from "../../abstractions/app-id.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { MessagingService } from "../../abstractions/messaging.service";
import { supportSwitch } from "../../misc/support-status";
import { ServerNotificationsService } from "../server-notifications.service";

import { ReceiveMessage, SignalRConnectionService } from "./signalr-connection.service";
import { WebPushConnectionService } from "./webpush-connection.service";

export const DISABLED_NOTIFICATIONS_URL = "http://-";

export const AllowedMultiUserNotificationTypes = new Set<NotificationType>([
  NotificationType.AuthRequest,
]);

export class DefaultServerNotificationsService implements ServerNotificationsService {
  notifications$: Observable<readonly [NotificationResponse, UserId]>;

  private activitySubject = new BehaviorSubject<"active" | "inactive">("active");

  constructor(
    private readonly logService: LogService,
    private syncService: SyncService,
    private appIdService: AppIdService,
    private environmentService: EnvironmentService,
    private logoutCallback: (logoutReason: LogoutReason, userId: UserId) => Promise<void>,
    private messagingService: MessagingService,
    private readonly accountService: AccountService,
    private readonly signalRConnectionService: SignalRConnectionService,
    private readonly authService: AuthService,
    private readonly webPushConnectionService: WebPushConnectionService,
    private readonly authRequestAnsweringService: AuthRequestAnsweringServiceAbstraction,
    private readonly configService: ConfigService,
  ) {
    this.notifications$ = this.configService
      .getFeatureFlag$(FeatureFlag.InactiveUserServerNotification)
      .pipe(
        distinctUntilChanged(),
        switchMap((inactiveUserServerNotificationEnabled) => {
          if (inactiveUserServerNotificationEnabled) {
            return this.accountService.accounts$.pipe(
              map((accounts: Record<UserId, AccountInfo>): Set<UserId> => {
                const validUserIds = Object.entries(accounts)
                  .filter(
                    ([_, accountInfo]) => accountInfo.email !== "" || accountInfo.emailVerified,
                  )
                  .map(([userId, _]) => userId as UserId);
                return new Set(validUserIds);
              }),
              trackedMerge((id: UserId) => {
                return this.userNotifications$(id as UserId).pipe(
                  map(
                    (notification: NotificationResponse) => [notification, id as UserId] as const,
                  ),
                );
              }),
            );
          }

          return this.accountService.activeAccount$.pipe(
            map((account) => account?.id),
            distinctUntilChanged(),
            switchMap((activeAccountId) => {
              if (activeAccountId == null) {
                // We don't emit server-notifications for inactive accounts currently
                return EMPTY;
              }

              return this.userNotifications$(activeAccountId).pipe(
                map((notification) => [notification, activeAccountId] as const),
              );
            }),
          );
        }),
        share(), // Multiple subscribers should only create a single connection to the server
      );
  }

  /**
   * Retrieves a stream of push server notifications for the given user.
   * @param userId The user id of the user to get the push server notifications for.
   */
  private userNotifications$(userId: UserId) {
    return this.environmentService.getEnvironment$(userId).pipe(
      map((env) => env.getNotificationsUrl()),
      distinctUntilChanged(),
      switchMap((notificationsUrl) => {
        if (notificationsUrl === DISABLED_NOTIFICATIONS_URL) {
          return EMPTY;
        }

        return this.userNotificationsHelper$(userId, notificationsUrl);
      }),
    );
  }

  private userNotificationsHelper$(userId: UserId, notificationsUrl: string) {
    return this.hasAccessToken$(userId).pipe(
      switchMap((hasAccessToken) => {
        if (!hasAccessToken) {
          return EMPTY;
        }

        return this.activitySubject;
      }),
      switchMap((activityStatus) => {
        if (activityStatus === "inactive") {
          return EMPTY;
        }

        return this.webPushConnectionService.supportStatus$(userId);
      }),
      supportSwitch({
        supported: (service) => {
          this.logService.info("Using WebPush for server notifications");
          return service.notifications$.pipe(
            catchError((err: unknown) => {
              this.logService.warning("Issue with web push, falling back to SignalR", err);
              return this.connectSignalR$(userId, notificationsUrl);
            }),
          );
        },
        notSupported: () => {
          this.logService.info("Using SignalR for server notifications");
          return this.connectSignalR$(userId, notificationsUrl);
        },
      }),
    );
  }

  private connectSignalR$(userId: UserId, notificationsUrl: string) {
    return this.signalRConnectionService.connect$(userId, notificationsUrl).pipe(
      filter((n) => n.type === "ReceiveMessage"),
      map((n) => (n as ReceiveMessage).message),
    );
  }

  private hasAccessToken$(userId: UserId) {
    return this.configService.getFeatureFlag$(FeatureFlag.PushNotificationsWhenLocked).pipe(
      distinctUntilChanged(),
      switchMap((featureFlagEnabled) => {
        if (featureFlagEnabled) {
          return this.authService.authStatusFor$(userId).pipe(
            map(
              (authStatus) =>
                authStatus === AuthenticationStatus.Locked ||
                authStatus === AuthenticationStatus.Unlocked,
            ),
            distinctUntilChanged(),
          );
        } else {
          return this.authService.authStatusFor$(userId).pipe(
            map((authStatus) => authStatus === AuthenticationStatus.Unlocked),
            distinctUntilChanged(),
          );
        }
      }),
    );
  }

  private async processNotification(notification: NotificationResponse, userId: UserId) {
    const appId = await this.appIdService.getAppId();
    if (notification == null || notification.contextId === appId) {
      return;
    }

    const payloadUserId = notification.payload?.userId || notification.payload?.UserId;
    if (payloadUserId != null && payloadUserId !== userId) {
      return;
    }

    if (
      await firstValueFrom(
        this.configService.getFeatureFlag$(FeatureFlag.InactiveUserServerNotification),
      )
    ) {
      const activeAccountId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );

      const isActiveUser = activeAccountId === userId;
      if (!isActiveUser && !AllowedMultiUserNotificationTypes.has(notification.type)) {
        return;
      }
    }

    switch (notification.type) {
      case NotificationType.SyncCipherCreate:
      case NotificationType.SyncCipherUpdate:
        await this.syncService.syncUpsertCipher(
          notification.payload as SyncCipherNotification,
          notification.type === NotificationType.SyncCipherUpdate,
          userId,
        );
        break;
      case NotificationType.SyncCipherDelete:
      case NotificationType.SyncLoginDelete:
        await this.syncService.syncDeleteCipher(
          notification.payload as SyncCipherNotification,
          userId,
        );
        break;
      case NotificationType.SyncFolderCreate:
      case NotificationType.SyncFolderUpdate:
        await this.syncService.syncUpsertFolder(
          notification.payload as SyncFolderNotification,
          notification.type === NotificationType.SyncFolderUpdate,
          userId,
        );
        break;
      case NotificationType.SyncFolderDelete:
        await this.syncService.syncDeleteFolder(
          notification.payload as SyncFolderNotification,
          userId,
        );
        break;
      case NotificationType.SyncVault:
      case NotificationType.SyncCiphers:
      case NotificationType.SyncSettings:
        await this.syncService.fullSync(false);
        break;
      case NotificationType.SyncOrganizations:
        // An organization update may not have bumped the user's account revision date, so force a sync
        await this.syncService.fullSync(true);
        break;
      case NotificationType.SyncOrgKeys:
        await this.syncService.fullSync(true);
        this.activitySubject.next("inactive"); // Force a disconnect
        this.activitySubject.next("active"); // Allow a reconnect
        break;
      case NotificationType.LogOut:
        this.logService.info("[Notifications Service] Received logout notification");
        await this.logoutCallback("logoutNotification", userId);
        break;
      case NotificationType.SyncSendCreate:
      case NotificationType.SyncSendUpdate:
        await this.syncService.syncUpsertSend(
          notification.payload as SyncSendNotification,
          notification.type === NotificationType.SyncSendUpdate,
        );
        break;
      case NotificationType.SyncSendDelete:
        await this.syncService.syncDeleteSend(notification.payload as SyncSendNotification);
        break;
      case NotificationType.AuthRequest:
        if (
          await firstValueFrom(
            this.configService.getFeatureFlag$(FeatureFlag.PM14938_BrowserExtensionLoginApproval),
          )
        ) {
          await this.authRequestAnsweringService.receivedPendingAuthRequest(
            notification.payload.userId,
            notification.payload.id,
          );
        }
        this.messagingService.send("openLoginApproval", {
          notificationId: notification.payload.id,
        });
        break;
      case NotificationType.SyncOrganizationStatusChanged:
        await this.syncService.fullSync(true);
        break;
      case NotificationType.SyncOrganizationCollectionSettingChanged:
        await this.syncService.fullSync(true);
        break;
      default:
        break;
    }
  }

  startListening() {
    return this.notifications$
      .pipe(
        mergeMap(async ([notification, userId]) => this.processNotification(notification, userId)),
      )
      .subscribe({
        error: (e: unknown) =>
          this.logService.warning("Error in server notifications$ observable", e),
      });
  }

  reconnectFromActivity(): void {
    this.activitySubject.next("active");
  }

  disconnectFromInactivity(): void {
    this.activitySubject.next("inactive");
  }
}
