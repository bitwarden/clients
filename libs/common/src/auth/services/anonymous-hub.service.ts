// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  IHubProtocol,
} from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { firstValueFrom } from "rxjs";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { AuthRequestServiceAbstraction } from "../../../../auth/src/common/abstractions";
import { NotificationType } from "../../enums";
import {
  AuthRequestPushNotification,
  NotificationResponse,
} from "../../models/response/notification.response";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { InsecureUrlNotAllowedError } from "../../services/api-errors";
import { AnonymousHubService as AnonymousHubServiceAbstraction } from "../abstractions/anonymous-hub.service";

export class AnonymousHubService implements AnonymousHubServiceAbstraction {
  private anonHubConnection: HubConnection;
  private url: string;

  constructor(
    private environmentService: EnvironmentService,
    private authRequestService: AuthRequestServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  async createHubConnection(token: string) {
    this.url = (await firstValueFrom(this.environmentService.environment$)).getNotificationsUrl();
    if (!this.url.startsWith("https://") && !this.platformUtilsService.isDev()) {
      throw new InsecureUrlNotAllowedError();
    }

    this.anonHubConnection = new HubConnectionBuilder()
      .withUrl(this.url + "/anonymous-hub?Token=" + token, {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withHubProtocol(new MessagePackHubProtocol() as IHubProtocol)
      .build();

    await this.anonHubConnection.start();

    this.anonHubConnection.on("AuthRequestResponseRecieved", (data: any) => {
      this.ProcessNotification(new NotificationResponse(data));
    });
  }

  async stopHubConnection() {
    if (this.anonHubConnection) {
      await this.anonHubConnection.stop();
    }
  }

  private ProcessNotification(notification: NotificationResponse) {
    switch (notification.type) {
      case NotificationType.AuthRequestResponse:
        this.authRequestService.sendAuthRequestPushNotification(
          notification.payload as AuthRequestPushNotification,
        );
    }
  }
}
