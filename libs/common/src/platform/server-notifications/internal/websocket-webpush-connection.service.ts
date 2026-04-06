import { Observable, of } from "rxjs";

import { UserId } from "../../../types/guid";
import { SupportStatus } from "../../misc/support-status";

import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";

export class WebSocketWebPushConnectionService implements WebPushConnectionService {
  supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>> {
    return of({ type: "not-supported", reason: "work-in-progress" });
  }
}
