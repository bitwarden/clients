import { Observable } from "rxjs";

import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { SupportStatus } from "../../misc/support-status";

export interface WebPushConnector {
  connect$(): Observable<NotificationResponse>;
}

export abstract class WebPushConnectionService {
  abstract supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>>;
}
