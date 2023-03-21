import { Injectable } from "@angular/core";
import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  IHubProtocol,
} from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";

import { AnonymousHubService as AnonymousHubServiceAbstraction } from "../abstractions/anonymousHub.service";
import { EnvironmentService } from "../abstractions/environment.service";
import { LogService } from "../abstractions/log.service";
import { AuthService } from "../auth/abstractions/auth.service";

import {
  AuthRequestPushNotification,
  NotificationResponse,
} from "./../models/response/notification.response";

@Injectable()
export class AnonymousHubService implements AnonymousHubServiceAbstraction {
  private anonHubConnection: HubConnection;
  private url: string;

  constructor(
    private environmentService: EnvironmentService,
    private authService: AuthService,
    private logService: LogService
  ) {}

  async createHubConnection(token: string) {
    this.url = this.environmentService.getNotificationsUrl();

    this.anonHubConnection = new HubConnectionBuilder()
      .withUrl(this.url + "/anonymous-hub?Token=" + token, {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withHubProtocol(new MessagePackHubProtocol() as IHubProtocol)
      .build();

    this.anonHubConnection.start().catch((error) => this.logService.error(error));

    this.anonHubConnection.on("AuthRequestResponseRecieved", (data: any) => {
      this.ProcessNotification(new NotificationResponse(data));
    });
  }

  stopHubConnection() {
    if (this.anonHubConnection) {
      this.anonHubConnection.stop();
    }
  }

  private async ProcessNotification(notification: NotificationResponse) {
    await this.authService.authResponsePushNotification(
      notification.payload as AuthRequestPushNotification
    );
  }
}
