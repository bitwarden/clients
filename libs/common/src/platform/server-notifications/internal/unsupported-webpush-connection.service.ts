import { Observable, of } from "rxjs";

import { UserId } from "../../../types/guid";
import { SupportStatus } from "../../misc/support-status";

import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";

/**
 * An implementation of {@see WebPushConnectionService} for clients that do not have support for WebPush
 */
export class UnsupportedWebPushConnectionService implements WebPushConnectionService {
  supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>> {
    return of({ type: "not-supported", reason: "client-not-supported" });
  }
}
