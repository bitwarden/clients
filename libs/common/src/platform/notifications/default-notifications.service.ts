import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subscription,
  catchError,
  distinctUntilChanged,
  map,
  mergeMap,
  share,
  switchMap,
} from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";

import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { NotificationType } from "../../enums";
import {
  NotificationResponse,
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../models/response/notification.response";
import { SyncService } from "../../vault/abstractions/sync/sync.service.abstraction";
import { AppIdService } from "../abstractions/app-id.service";
import { EnvironmentService } from "../abstractions/environment.service";
import { LogService } from "../abstractions/log.service";
import { MessagingService } from "../abstractions/messaging.service";

import { ConnectionBuilder } from "./connection.builder";
import { Notification, NotificationsService } from "./notifications.service";

export class DefaultNotificationsService implements NotificationsService {
  private readonly activitySubject = new BehaviorSubject<"active" | "inactive">("active");
  private readonly activity$ = this.activitySubject.asObservable().pipe(distinctUntilChanged());

  private notifications$: Observable<Notification>;

  constructor(
    private readonly logService: LogService,
    private readonly syncService: SyncService,
    private readonly appIdService: AppIdService,
    private readonly environmentService: EnvironmentService,
    private logoutCallback: (logoutReason: LogoutReason) => Promise<void>,
    private readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly accountService: AccountService,
    private readonly connectionBuilder: ConnectionBuilder,
  ) {
    // We only connect the web socket for the currently active user
    this.notifications$ = this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (account == null) {
          return EMPTY;
        }

        // When a new account is switched to it should always be considered active
        this.activitySubject.next("active");
        return this.authService.authStatusFor$(account.id).pipe(
          switchMap((authStatus) => {
            if (authStatus !== AuthenticationStatus.Unlocked) {
              return EMPTY;
            }

            // Would be great if EnvironmentService had a way for us to supply a user id
            return this.environmentService.environment$.pipe(
              map((environment) => environment.getNotificationsUrl()),
              switchMap((notificationsUrl) => {
                // Set notifications server URL to `https://-` to effectively disable communication
                // with the notifications server from the client app
                if (notificationsUrl === "https://-") {
                  return EMPTY;
                }

                // Let activity subject have final control
                return this.activity$.pipe(
                  switchMap((activity) => {
                    if (activity !== "active") {
                      return EMPTY;
                    }

                    return this.connectionBuilder.build(notificationsUrl, account.id).pipe(
                      catchError((err: unknown) => {
                        this.logService.warning(
                          "Error during notificatons service connection",
                          err,
                        );
                        return EMPTY;
                      }),
                      share(), // Just one connection for all subscribers
                    );
                  }),
                  map((response) => ({ userId: account.id, data: response })),
                );
              }),
            );
          }),
        );
      }),
    );
  }

  start(): Subscription {
    return this.startInternal().subscribe();
  }

  /**
   * Not private so that it is easily accessible in tests
   */
  startInternal(): Observable<void> {
    return this.notifications$.pipe(
      // Merge Map Because these should be pretty fire and forget
      mergeMap(async (notification) => {
        try {
          await this.processNotification(notification.data);
        } catch (err) {
          this.logService.error(
            `Error while process notification of type ${notification.data.type}`,
            err,
          );
        }
      }),
    );
  }

  private async processNotification(notification: NotificationResponse) {
    // TODO: Migrate this into the observable stream to avoid emitting notifications we shouldn't respond to
    const appId = await this.appIdService.getAppId();
    if (notification == null || notification.contextId === appId) {
      return;
    }

    switch (notification.type) {
      case NotificationType.SyncCipherCreate:
      case NotificationType.SyncCipherUpdate:
        await this.syncService.syncUpsertCipher(
          notification.payload as SyncCipherNotification,
          notification.type === NotificationType.SyncCipherUpdate,
        );
        break;
      case NotificationType.SyncCipherDelete:
      case NotificationType.SyncLoginDelete:
        await this.syncService.syncDeleteCipher(notification.payload as SyncCipherNotification);
        break;
      case NotificationType.SyncFolderCreate:
      case NotificationType.SyncFolderUpdate:
        await this.syncService.syncUpsertFolder(
          notification.payload as SyncFolderNotification,
          notification.type === NotificationType.SyncFolderUpdate,
        );
        break;
      case NotificationType.SyncFolderDelete:
        await this.syncService.syncDeleteFolder(notification.payload as SyncFolderNotification);
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
        // Cycle activity as a way to force a reconnect with a new access token
        this.activitySubject.next("inactive");
        this.activitySubject.next("active");
        break;
      case NotificationType.LogOut:
        await this.logoutCallback("logoutNotification");
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
        {
          this.messagingService.send("openLoginApproval", {
            notificationId: notification.payload.id,
          });
        }
        break;
      default:
        break;
    }
  }

  reconnectFromActivity(): void {
    this.activitySubject.next("active");
  }
  disconnectFromInactivity(): void {
    this.activitySubject.next("inactive");
  }
}
