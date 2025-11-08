import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
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
   * @param userId The UserId that the auth request is for.
   * @param authRequestId The authRequestId param is not used on Desktop because clicks on a
   *                      Desktop notification do not run any auth-request-specific actions.
   *                      All clicks simply open the Desktop window. See electron-main-messaging.service.ts.
   */
  async receivedPendingAuthRequest(userId: UserId, authRequestId: string): Promise<void> {
    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(userId);

    const userMeetsConditionsToShowApprovalDialog =
      await this.userMeetsConditionsToShowApprovalDialog(userId);

    if (userMeetsConditionsToShowApprovalDialog) {
      // Send message to open dialog immediately for this request
      this.messagingService.send("openLoginApproval");
    }

    const isWindowVisible = await ipc.platform.isWindowVisible();

    // Create a system notification if either of the following are true:
    // - User does NOT meet conditions to show dialog
    // - User does meet conditions, but the Desktop window is not visible
    //   - In this second case, we both send the "openLoginApproval" message (above) AND
    //     also create the system notification to notify the user that the dialog is there.
    if (!userMeetsConditionsToShowApprovalDialog || !isWindowVisible) {
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const emailForUser = accounts[userId].email;
      await ipc.auth.loginRequest(
        this.i18nService.t("accountAccessRequested"),
        this.i18nService.t("confirmAccessAttempt", emailForUser),
        this.i18nService.t("close"),
      );
    }
  }
}
