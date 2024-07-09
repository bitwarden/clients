import { Observable } from "rxjs";

import { NotificationResponse } from "../../models/response/notification.response";
import { UserId } from "../../types/guid";

export abstract class ConnectionBuilder {
  abstract build(url: string, activeUserId: UserId): Observable<NotificationResponse>;
}
