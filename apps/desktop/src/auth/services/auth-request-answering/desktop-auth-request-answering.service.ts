import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

export class DesktopAuthRequestAnsweringService
  extends DefaultAuthRequestAnsweringService
  implements AuthRequestAnsweringService
{
  constructor(
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly masterPasswordService: MasterPasswordServiceAbstraction,
    protected readonly messagingService: MessagingService,
    protected readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
    private readonly configService: ConfigService,
  ) {
    super(
      accountService,
      authService,
      masterPasswordService,
      messagingService,
      pendingAuthRequestsState,
    );
  }

  /**
   * @param authRequestUserId The UserId that the auth request is for.
   * TODO: PM-34438 - clean up this comment when we remove the PM34210_DesktopAddDevices flag
   * @param authRequestId When the PM34210_DesktopAddDevices flag is enabled, this is forwarded
   *                      in the 'openLoginApproval' message so the DeviceManagementComponent can
   *                      upsert the pending device inline. When the flag is disabled, it is not
   *                      used — Desktop notification clicks simply open the window.
   *                      See electron-main-messaging.service.ts.
   */
  async receivedPendingAuthRequest(
    authRequestUserId: UserId,
    authRequestId: string,
  ): Promise<void> {
    if (!authRequestUserId) {
      throw new Error("authRequestUserId required");
    }

    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(authRequestUserId);

    const activeUserMeetsConditionsToShowApprovalDialog =
      await this.activeUserMeetsConditionsToShowApprovalDialog(authRequestUserId);

    if (activeUserMeetsConditionsToShowApprovalDialog) {
      const desktopAddDevicesEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.PM34210_DesktopAddDevices,
      );

      // Send message to open dialog immediately for this request.
      // Include notificationId when the feature flag is enabled so the
      // DeviceManagementComponent can upsert the pending device inline.
      if (desktopAddDevicesEnabled) {
        this.messagingService.send("openLoginApproval", { notificationId: authRequestId });
      } else {
        this.messagingService.send("openLoginApproval");
      }
    }

    const isWindowVisible = await ipc.platform.isWindowVisible();

    // Create a system notification if either of the following are true:
    // - User does NOT meet conditions to show dialog
    // - User does meet conditions, but the Desktop window is not visible
    //   - In this second case, we both send the "openLoginApproval" message (above) AND
    //     also create the system notification to notify the user that the dialog is there.
    if (!activeUserMeetsConditionsToShowApprovalDialog || !isWindowVisible) {
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const accountInfo = accounts[authRequestUserId];

      if (!accountInfo) {
        this.logService.error("Account not found for authRequestUserId");
        return;
      }

      const emailForUser = accountInfo.email;
      await ipc.auth.loginRequest(
        this.i18nService.t("accountAccessRequested"),
        this.i18nService.t("confirmAccessAttempt", emailForUser),
        this.i18nService.t("close"),
      );
    }
  }
}
