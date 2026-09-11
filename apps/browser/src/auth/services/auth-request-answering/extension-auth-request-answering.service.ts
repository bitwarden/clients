import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthServerNotificationTags } from "@bitwarden/common/auth/enums/auth-server-notification-tags";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
    if (!authRequestUserId) {
      throw new Error("authRequestUserId required");
    }
    if (!authRequestId) {
      throw new Error("authRequestId required");
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
        this.logService.error("Account not found for authRequestUserId");
        return;
      }

      const emailForUser = accountInfo.email;
      await this.systemNotificationsService.create({
        // The userId is encoded so the click handler can switch to the request's owner.
        // Both GUIDs are hyphenated with no underscores, so the underscore remains an unambiguous delimiter.
        id: `${AuthServerNotificationTags.AuthRequest}_${authRequestUserId}_${authRequestId}`, // the underscore is an important delimiter.
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
   * Switches the active account to the auth request's owner (if it differs from the active
   * account and is still a known account) before opening the popup. The popup's own unlock
   * listeners then surface the approval dialog against the now-active account. If the target
   * cannot be resolved (malformed id, logged-out/removed account), it falls back to opening the
   * popup on the current active account.
   *
   * @param event The event passed in. Check initNotificationSubscriptions in main.background.ts.
   */
  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    if (event.buttonIdentifier !== ButtonLocation.NotificationButton) {
      return;
    }

    await this.systemNotificationsService.clear({
      id: `${event.id}`,
    });

    const targetUserId = await this.resolveSwitchTargetUserId(event.id);
    if (targetUserId != null) {
      this.messagingService.send("switchAccount", { userId: targetUserId });
    }

    await this.actionService.openPopup();
  }

  /**
   * Parses the target userId out of the notification id and returns it only when a switch is
   * warranted: the id is well-formed, the target differs from the active account, and the target
   * is still a known account. Returns null otherwise (fall back to opening the active account).
   */
  private async resolveSwitchTargetUserId(notificationId: string): Promise<UserId | null> {
    const prefix = `${AuthServerNotificationTags.AuthRequest}_`;
    if (!notificationId.startsWith(prefix)) {
      return null;
    }

    // Remainder is `${authRequestUserId}_${authRequestId}` — both GUIDs, so exactly two parts.
    const parts = notificationId.slice(prefix.length).split("_");
    if (parts.length !== 2 || !parts[0]) {
      return null;
    }

    const targetUserId = parts[0] as UserId;

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (targetUserId === activeUserId) {
      return null;
    }

    const accounts = await firstValueFrom(this.accountService.accounts$);
    if (accounts[targetUserId] == null) {
      return null;
    }

    return targetUserId;
  }
}
