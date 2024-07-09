import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { Observable } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { NotificationResponse } from "../../models/response/notification.response";
import { UserId } from "../../types/guid";
import { LogService } from "../abstractions/log.service";

import { ConnectionBuilder } from "./connection.builder";

const RETRY_DELAYS = [
  2 * 60 * 1000, // 2 minutes
  3 * 60 * 1000, // 3 minutes
  4 * 60 * 1000, // 4 minutes
  5 * 60 * 1000, // 5 minutes
];

const createSignalRLogger = (logService: LogService) => {
  return new (class implements signalR.ILogger {
    log(logLevel: signalR.LogLevel, message: string): void {
      // Ignore things less than warning
      switch (logLevel) {
        case LogLevel.Warning:
          logService.warning(message);
          break;
        case LogLevel.Error:
        case LogLevel.Critical:
          logService.error(message);
          break;
      }
    }
  })();
};

export class SignalRConnectionBuilder implements ConnectionBuilder {
  constructor(
    private readonly logService: LogService,
    private readonly apiService: ApiService,
  ) {}

  build(url: string, activeUserId: UserId): Observable<NotificationResponse> {
    return new Observable<NotificationResponse>((subscriber) => {
      const connection = new HubConnectionBuilder()
        .withUrl(url + "/hub", {
          accessTokenFactory: async () => this.apiService.getActiveBearerToken(),
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
        })
        .withHubProtocol(new MessagePackHubProtocol())
        .configureLogging(createSignalRLogger(this.logService))
        .withAutomaticReconnect(RETRY_DELAYS)
        .build();

      connection.on("ReceiveMessage", (data) => {
        subscriber.next(new NotificationResponse(data));
      });

      connection.on("Heartbeat", () => {
        /*console.log('Heartbeat!');*/
      });

      connection.onclose((err) => {
        if (err != null) {
          subscriber.error(err);
          return;
        }

        subscriber.complete();
      });

      connection.start().catch((err) => {
        // Handle known errors into more friendly messages
        if (
          err?.message ===
          "WebSocket failed to connect. The connection could not be found on the server, either the endpoint may not be a SignalR endpoint, the connection ID is not present on the server, or there is a proxy blocking WebSockets. If you have multiple servers check that sticky sessions are enabled."
        ) {
          subscriber.error(
            new Error(
              "Failed to connect to Bitwarden notifications service, please check that your URL is correct and that the service is running.",
            ),
          );
          return;
        }

        subscriber.error(err);
      });

      return () => {
        connection.off("ReceiveMessage");
        connection.off("Heartbeat");
        if (connection.state !== HubConnectionState.Disconnected) {
          void connection.stop().catch((err) => {
            this.logService.error("Error while stopping WebSocket Connection", err);
          });
        }
      };
    });
  }
}
