import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthServerNotificationTags } from "@bitwarden/common/auth/enums/auth-server-notification-tags";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import {
  ButtonLocation,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

export class ExtensionAuthRequestAnsweringService
  extends DefaultAuthRequestAnsweringService
  implements AuthRequestAnsweringService
{
  constructor(
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly masterPasswordService: MasterPasswordServiceAbstraction,
    protected readonly messagingService: MessagingService,
    protected readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
    private readonly actionService: ActionsService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly systemNotificationsService: SystemNotificationsService,
    private readonly logService: LogService,
    private readonly validationService: ValidationService,
  ) {
    super(
      accountService,
      authService,
      masterPasswordService,
      messagingService,
      pendingAuthRequestsState,
    );
  }

  async receivedPendingAuthRequest(
    authRequestUserId: UserId,
    authRequestId: string,
  ): Promise<void> {
    if (!authRequestId) {
      throw new Error("authRequestId not found.");
    }

    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(authRequestUserId);

    const activeUserMeetsConditionsToShowApprovalDialog =
      await this.activeUserMeetsConditionsToShowApprovalDialog(authRequestUserId);

    if (activeUserMeetsConditionsToShowApprovalDialog) {
      // Send message to open dialog immediately for this request
      this.messagingService.send("openLoginApproval", {
        // Include the authRequestId so the DeviceManagementComponent can upsert the correct device.
        // This will only matter if the user is on the /device-management screen when the auth request is received.
        notificationId: authRequestId,
      });
    } else {
      // Create a system notification
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const accountInfo = accounts[authRequestUserId];

      if (!accountInfo) {
        this.logService.error(`Account not found for userId: ${authRequestUserId}`);
        this.validationService.showError(`Account not found for userId: ${authRequestUserId}`);
        return;
      }

      const emailForUser = accountInfo.email;
      await this.systemNotificationsService.create({
        id: `${AuthServerNotificationTags.AuthRequest}_${authRequestId}`, // the underscore is an important delimiter.
        title: this.i18nService.t("accountAccessRequested"),
        body: this.i18nService.t("confirmAccessAttempt", emailForUser),
        buttons: [],
      });
    }
  }

  async activeUserMeetsConditionsToShowApprovalDialog(authRequestUserId: UserId): Promise<boolean> {
    const meetsBasicConditions = await super.activeUserMeetsConditionsToShowApprovalDialog(
      authRequestUserId,
    );

    // To show an approval dialog immediately on Extension, the popup must be open.
    const isPopupOpen = await this.platformUtilsService.isPopupOpen();
    const meetsExtensionConditions = meetsBasicConditions && isPopupOpen;

    return meetsExtensionConditions;
  }

  /**
   * When a system notification is clicked, this function is used to process that event.
   *
   * @param event The event passed in. Check initNotificationSubscriptions in main.background.ts.
   */
  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    if (event.buttonIdentifier === ButtonLocation.NotificationButton) {
      await this.systemNotificationsService.clear({
        id: `${event.id}`,
      });
      await this.actionService.openPopup();
    }
  }
}
