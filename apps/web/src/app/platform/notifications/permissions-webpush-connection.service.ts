import { concat, defer, fromEvent, map, Observable, of, switchMap } from "rxjs";

import { SupportStatus } from "@bitwarden/common/platform/misc/support-status";
// eslint-disable-next-line no-restricted-imports -- In platform owned code.
import {
  WebPushConnector,
  WorkerWebPushConnectionService,
} from "@bitwarden/common/platform/server-notifications/internal";
import { UserId } from "@bitwarden/common/types/guid";

export class PermissionsWebPushConnectionService extends WorkerWebPushConnectionService {
  override supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>> {
    return this.notificationPermission$().pipe(
      switchMap((notificationPermission) => {
        if (notificationPermission === "denied") {
          return of<SupportStatus<WebPushConnector>>({
            type: "not-supported",
            reason: "permission-denied",
          });
        }

        if (notificationPermission === "default") {
          return of<SupportStatus<WebPushConnector>>({
            type: "needs-configuration",
            reason: "permission-not-requested",
          });
        }

        if (notificationPermission === "prompt") {
          return of<SupportStatus<WebPushConnector>>({
            type: "needs-configuration",
            reason: "prompt-must-be-granted",
          });
        }

        // Delegate to default worker checks
        return super.supportStatus$(userId);
      }),
    );
  }

  private notificationPermission$() {
    return concat(
      of(Notification.permission),
      defer(async () => {
        return await window.navigator.permissions.query({ name: "notifications" });
      }).pipe(
        switchMap((permissionStatus) => {
          return fromEvent(permissionStatus, "change").pipe(map(() => permissionStatus.state));
        }),
      ),
    );
  }
}
