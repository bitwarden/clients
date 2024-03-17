import * as signalR from "@microsoft/signalr";
import * as signalRMsgPack from "@microsoft/signalr-protocol-msgpack";

import { ApiService } from "../abstractions/api.service";
import { NotificationsService as NotificationsServiceAbstraction } from "../abstractions/notifications.service";
import { AuthService } from "../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../auth/enums/authentication-status";
import { NotificationType } from "../enums";
import {
  NotificationResponse,
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../models/response/notification.response";
import { AppIdService } from "../platform/abstractions/app-id.service";
import { EnvironmentService } from "../platform/abstractions/environment.service";
import { LogService } from "../platform/abstractions/log.service";
import { MessagingService } from "../platform/abstractions/messaging.service";
import { StateService } from "../platform/abstractions/state.service";
import { SyncService } from "../vault/abstractions/sync/sync.service.abstraction";

export class NotificationsService implements NotificationsServiceAbstraction {
  private signalrConnection: signalR.HubConnection;
  private url: string;
  private connected = false;
  private inited = false;
  private inactive = false;
  private reconnectTimer: any = null;

  constructor(
    private logService: LogService,
    private syncService: SyncService,
    private appIdService: AppIdService,
    private apiService: ApiService,
    private environmentService: EnvironmentService,
    private logoutCallback: (expired: boolean) => Promise<void>,
    private stateService: StateService,
    private authService: AuthService,
    private messagingService: MessagingService,
  ) {
    this.environmentService.urls.subscribe(() => {
      if (!this.inited) {
        return;
      }

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.init();
    });
  }

  async init(): Promise<void> {
    this.inited = false;
    this.url = this.environmentService.getNotificationsUrl();

    // Set notifications server URL to `https://-` to effectively disable communication
    // with the notifications server from the client app
    if (this.url === "https://-") {
      return;
    }

    if (this.signalrConnection != null) {
      this.signalrConnection.off("ReceiveMessage");
      this.signalrConnection.off("Heartbeat");
      await this.signalrConnection.stop();
      this.connected = false;
      this.signalrConnection = null;
    }

    this.signalrConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.url + "/hub", {
        accessTokenFactory: () => this.apiService.getActiveBearerToken(),
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withHubProtocol(new signalRMsgPack.MessagePackHubProtocol() as signalR.IHubProtocol)
      // .configureLogging(signalR.LogLevel.Trace)
      .build();

    this.signalrConnection.on("ReceiveMessage", (data: any) =>
      this.processNotification(new NotificationResponse(data)),
    );
    // eslint-disable-next-line
    this.signalrConnection.on("Heartbeat", (data: any) => {
      /*console.log('Heartbeat!');*/
    });
    this.signalrConnection.onclose(() => {
      this.connected = false;
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.reconnect(true);
    });
    this.inited = true;
    if (await this.isAuthedAndUnlocked()) {
      await this.reconnect(false);
    }
  }

  async updateConnection(sync = false): Promise<void> {
    if (!this.inited) {
      return;
    }
    try {
      if (await this.isAuthedAndUnlocked()) {
        await this.reconnect(sync);
      } else {
        await this.signalrConnection.stop();
      }
    } catch (e) {
      this.logService.error(e.toString());
    }
  }

  async reconnectFromActivity(): Promise<void> {
    this.inactive = false;
    if (this.inited && !this.connected) {
      await this.reconnect(true);
    }
  }

  async disconnectFromInactivity(): Promise<void> {
    this.inactive = true;
    if (this.inited && this.connected) {
      await this.signalrConnection.stop();
    }
  }

  private async processNotification(notification: NotificationResponse) {
    const appId = await this.appIdService.getAppId();
    if (notification == null || notification.contextId === appId) {
      return;
    }

    const isAuthenticated = await this.stateService.getIsAuthenticated();
    const payloadUserId = notification.payload.userId || notification.payload.UserId;
    const myUserId = await this.stateService.getUserId();
    if (isAuthenticated && payloadUserId != null && payloadUserId !== myUserId) {
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
        if (isAuthenticated) {
          await this.syncService.fullSync(false);
        }
        break;
      case NotificationType.SyncOrganizations:
        if (isAuthenticated) {
          // An organization update may not have bumped the user's account revision date, so force a sync
          await this.syncService.fullSync(true);
        }
        break;
      case NotificationType.SyncOrgKeys:
        if (isAuthenticated) {
          await this.syncService.fullSync(true);
          // Stop so a reconnect can be made
          await this.signalrConnection.stop();
        }
        break;
      case NotificationType.LogOut:
        if (isAuthenticated) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.logoutCallback(true);
        }
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
        if (await this.stateService.getApproveLoginRequests()) {
          this.messagingService.send("openLoginApproval", {
            notificationId: notification.payload.id,
          });
        }
        break;
      default:
        break;
    }
  }

  private async reconnect(sync: boolean) {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connected || !this.inited || this.inactive) {
      return;
    }
    const authedAndUnlocked = await this.isAuthedAndUnlocked();
    if (!authedAndUnlocked) {
      return;
    }

    try {
      await this.signalrConnection.start();
      this.connected = true;
      if (sync) {
        await this.syncService.fullSync(false);
      }
    } catch (e) {
      this.logService.error(e);
    }

    if (!this.connected) {
      this.reconnectTimer = setTimeout(() => this.reconnect(sync), this.random(120000, 300000));
    }
  }

  private async isAuthedAndUnlocked() {
    const authStatus = await this.authService.getAuthStatus();
    return authStatus >= AuthenticationStatus.Unlocked;
  }

  private random(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
