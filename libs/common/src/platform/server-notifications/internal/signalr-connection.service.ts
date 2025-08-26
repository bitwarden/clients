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

export type TimeoutManager = {
  setTimeout: (handler: TimerHandler, timeout: number) => number;
  clearTimeout: (timeoutId: number) => void;
};

class SignalRLogger implements ILogger {
  constructor(private readonly logService: LogService) {}

  redactMessage(message: string): string {
    const ACCESS_TOKEN_TEXT = "access_token=";
    // Redact the access token from the logs if it exists.
    const accessTokenIndex = message.indexOf(ACCESS_TOKEN_TEXT);
    if (accessTokenIndex !== -1) {
      return message.substring(0, accessTokenIndex + ACCESS_TOKEN_TEXT.length) + "[REDACTED]";
    }

    return message;
  }

  log(logLevel: LogLevel, message: string): void {
    const redactedMessage = `[SignalR] ${this.redactMessage(message)}`;

    switch (logLevel) {
      case LogLevel.Critical:
        this.logService.error(redactedMessage);
        break;
      case LogLevel.Error:
        this.logService.error(redactedMessage);
        break;
      case LogLevel.Warning:
        this.logService.warning(redactedMessage);
        break;
      case LogLevel.Information:
        this.logService.info(redactedMessage);
        break;
      case LogLevel.Debug:
        this.logService.debug(redactedMessage);
        break;
    }
  }
}

export class SignalRConnectionService {
  constructor(
    private readonly apiService: ApiService,
    private readonly logService: LogService,
    private readonly hubConnectionBuilderFactory: () => HubConnectionBuilder = () =>
      new HubConnectionBuilder(),
    private readonly timeoutManager: TimeoutManager = globalThis,
  ) {}

  connect$(userId: UserId, notificationsUrl: string) {
    return new Observable<SignalRNotification>((subsciber) => {
      const connection = this.hubConnectionBuilderFactory()
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
      const scheduleReconnect = () => {
        if (
          connection == null ||
          connection.state !== HubConnectionState.Disconnected ||
          (reconnectSubscription != null && !reconnectSubscription.closed)
        ) {
          // Skip scheduling a new reconnect, either the connection isn't disconnected
          // or an active reconnect is already scheduled.
          return;
        }

        // If we've somehow gotten here while the subscriber is closed,
        // we do not want to reconnect. So leave.
        if (subsciber.closed) {
          return;
        }

        const randomTime = this.randomReconnectTime();
        const timeoutHandler = this.timeoutManager.setTimeout(() => {
          connection
            .start()
            .then(() => {
              reconnectSubscription = null;
            })
            .catch(() => {
              scheduleReconnect();
            });
        }, randomTime);

        reconnectSubscription = new Subscription(() =>
          this.timeoutManager.clearTimeout(timeoutHandler),
        );
      };

      connection.onclose((error) => {
        scheduleReconnect();
      });

      // Start connection
      connection.start().catch(() => {
        scheduleReconnect();
      });

      return () => {
        // Cancel any possible scheduled reconnects
        reconnectSubscription?.unsubscribe();
        connection?.stop().catch((error) => {
          this.logService.error("Error while stopping SignalR connection", error);
        });
      };
    });
  }

  private randomReconnectTime() {
    return (
      Math.floor(Math.random() * (MAX_RECONNECT_TIME - MIN_RECONNECT_TIME + 1)) + MIN_RECONNECT_TIME
    );
  }
}
