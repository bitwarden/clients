import { filter, mergeMap } from "rxjs/operators";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonActions,
  SystemNotificationServiceAbstraction,
  SystemNotificationEvent,
  ButtonLocation,
} from "@bitwarden/common/platform/system-notifications/system-notification-service";

export abstract class AuthRequestLoginApprovalAbstraction {
  abstract receivedPendingAuthRequest(notificationId: string): Promise<void>;
  abstract checkForPendingAuthRequestsToApprove(notificationId: string): Promise<void>;
}

export class ChromeBrowserExtensionAuthRequestApprovalService
  implements AuthRequestLoginApprovalAbstraction
{
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private systemNotificationService: SystemNotificationServiceAbstraction,
  ) {
    this.systemNotificationService.systemNotificationClicked$
      .pipe(
        filter(
          (event: SystemNotificationEvent) => event.type === ButtonActions.AuthRequestNotification,
        ),
        mergeMap((event: SystemNotificationEvent) =>
          this.handleAuthRequestNotificationClicked(event),
        ),
      )
      .subscribe();
  }

  async receivedPendingAuthRequest(notificationId: string): Promise<void> {
    // if popup is open, open dialog if logged in
    if (await this.platformUtilsService.isViewOpen()) {
      this.logService.info("Open dialog to user to approve request.");
    } else {
      // if not open, create a notification

      // Short circuit because we don't support notifications on this client
      if (!this.systemNotificationService.isSupported()) {
        return;
      }

      await this.systemNotificationService.createOSNotification({
        title: "Pending Device Request",
        body: "Please view pending auth request",
        type: ButtonActions.AuthRequestNotification,
        id: notificationId,
        buttons: [{ title: "Approve Request" }, { title: "Deny Request" }],
      });
    }
  }

  /**
   * Use new device service's endpoint to query for all devices with pending
   * auth requests.
   *
   * This should be used on the application load.
   *
   * Navigates user to the devices management screen and opens a dialog
   * per pending login request.
   */
  async checkForPendingAuthRequestsToApprove(notificationId: string): Promise<void> {
    // STUB
  }

  /**
   * TODO: Requests are doubling, figure out if a subscription is duplicating or something.
   * @param event
   * @private
   */
  private async handleAuthRequestNotificationClicked(
    event: SystemNotificationEvent,
  ): Promise<void> {
    // This is the approval event. WE WILL NOT BE USING 0 or 1!
    if (event.buttonIdentifier === ButtonLocation.FirstOptionalButton) {
      this.logService.info("Approve the request");
    } else if (event.buttonIdentifier === ButtonLocation.SecondOptionalButton) {
      // This is the deny event.
      this.logService.info("Deny the request");
    } else if (event.buttonIdentifier === ButtonLocation.NotificationButton) {
      this.logService.info("Main button clicked, open popup");
      // This is unstable, to be figured out later.
      await this.platformUtilsService.openPopupToPath("/device-management");
      this.systemNotificationService.clearOSNotification({ id: event.id });
    }
  }
}
