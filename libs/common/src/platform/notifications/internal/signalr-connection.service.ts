import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  ILogger,
  LogLevel,
} from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { Observable, Subscription } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { LogService } from "../../abstractions/log.service";

// 2 Minutes
const MIN_RECONNECT_TIME = 2 * 60 * 1000;
// 5 Minutes
const MAX_RECONNECT_TIME = 5 * 60 * 1000;

export type Heartbeat = { type: "Heartbeat" };
export type ReceiveMessage = { type: "ReceiveMessage"; message: NotificationResponse };

export type SignalRNotification = Heartbeat | ReceiveMessage;

class SignalRLogger implements ILogger {
  constructor(private readonly logService: LogService) {}

  log(logLevel: LogLevel, message: string): void {
    switch (logLevel) {
      case LogLevel.Critical:
        this.logService.error(message);
        break;
      case LogLevel.Error:
        this.logService.error(message);
        break;
      case LogLevel.Warning:
        this.logService.warning(message);
        break;
      case LogLevel.Information:
        this.logService.info(message);
        break;
      case LogLevel.Debug:
        this.logService.debug(message);
        break;
    }
  }
}

export class SignalRConnectionService {
  constructor(
    private readonly apiService: ApiService,
    private readonly logService: LogService,
  ) {}

  connect$(userId: UserId, notificationsUrl: string) {
    return new Observable<SignalRNotification>((subsciber) => {
      const connection = new HubConnectionBuilder()
        .withUrl(notificationsUrl + "/hub", {
          accessTokenFactory: () => this.apiService.getActiveBearerToken(),
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
        })
        .withHubProtocol(new MessagePackHubProtocol())
        .configureLogging(new SignalRLogger(this.logService))
        .build();

      connection.on("ReceiveMessage", (data: any) => {
        subsciber.next({ type: "ReceiveMessage", message: new NotificationResponse(data) });
      });

      connection.on("Heartbeat", () => {
        subsciber.next({ type: "Heartbeat" });
      });

      let reconnectSubscription: Subscription | null = null;

      // Create schedule reconnect function
      const scheduleReconnect = (): Subscription => {
        if (
          connection == null ||
          connection.state !== HubConnectionState.Disconnected ||
          (reconnectSubscription != null && !reconnectSubscription.closed)
        ) {
          return Subscription.EMPTY;
        }

        const randomTime = this.random();
        const timeoutHandler = setTimeout(() => {
          connection
            .start()
            .then(() => (reconnectSubscription = null))
            .catch(() => {
              reconnectSubscription = scheduleReconnect();
            });
        }, randomTime);

        return new Subscription(() => clearTimeout(timeoutHandler));
      };

      connection.onclose((error) => {
        reconnectSubscription = scheduleReconnect();
      });

      // Start connection
      connection.start().catch(() => {
        reconnectSubscription = scheduleReconnect();
      });

      return () => {
        connection?.stop().catch((error) => {
          this.logService.error("Error while stopping SignalR connection", error);
          // TODO: Does calling stop call `onclose`?
          reconnectSubscription?.unsubscribe();
        });
      };
    });
  }

  private random() {
    return (
      Math.floor(Math.random() * (MAX_RECONNECT_TIME - MIN_RECONNECT_TIME + 1)) + MIN_RECONNECT_TIME
    );
  }
}
