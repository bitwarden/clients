import { fromEvent, Observable, of } from "rxjs";

import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { SupportStatus } from "../../misc/support-status";

import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";

export class WebSocketWebPushConnectionService
  implements WebPushConnectionService, WebPushConnector
{
  supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>> {
    return of({ type: "not-supported", reason: "work-in-progress" });
  }

  connect$(userId: UserId): Observable<NotificationResponse> {
    // TODO: Not currently recieving notifications
    return new Observable<NotificationResponse>((subscriber) => {
      const socket = new WebSocket("wss://push.services.mozilla.com");

      const messageSubscription = fromEvent<MessageEvent>(socket, "message").subscribe({
        next: (event) => {
          subscriber.next(new NotificationResponse(event.data));
        },
      });

      const closeSubscription = fromEvent<CloseEvent>(socket, "close").subscribe(() =>
        subscriber.complete(),
      );

      return () => {
        messageSubscription.unsubscribe();
        closeSubscription.unsubscribe();
        socket.close();
      };
    });
  }
}
