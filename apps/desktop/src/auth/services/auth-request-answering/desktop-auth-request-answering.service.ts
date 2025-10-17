import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import {
  PendingAuthRequestsStateService,
  PendingAuthUserMarker,
} from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
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

  override async receivedPendingAuthRequest(userId: UserId): Promise<void> {
    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(userId);

    const userIsAvailableToViewDialog = await this.userMeetsConditionsToShowApprovalDialog(userId);

    if (userIsAvailableToViewDialog) {
      // Send message to open dialog immediately for this request
      this.messagingService.send("openLoginApproval");
    } else {
      // Create a system notification
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const emailForUser = accounts[userId].email;
      await ipc.auth.loginRequest(
        this.i18nService.t("accountAccessRequested"),
        this.i18nService.t("confirmAccessAttempt", emailForUser),
        this.i18nService.t("close"),
      );
    }
  }

  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    const meetsBasicConditions = await super.userMeetsConditionsToShowApprovalDialog(userId);

    // To show an approval dialog immediately on Desktop, the window must be open.
    const isWindowVisible = await ipc.platform.isWindowVisible();
    const meetsExtensionConditions = meetsBasicConditions && isWindowVisible;

    return meetsExtensionConditions;
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent) {
    throw new Error("handleAuthRequestNotificationClicked() not implemented for this client");
  }

  async processPendingAuthRequests(): Promise<void> {
    // Prune any stale pending requests (older than 15 minutes)
    // This comes from GlobalSettings.cs
    //    public TimeSpan UserRequestExpiration { get; set; } = TimeSpan.FromMinutes(15);
    const fifteenMinutesMs = 15 * 60 * 1000;

    await this.pendingAuthRequestsState.pruneOlderThan(fifteenMinutesMs);

    const pendingAuthRequestsInState: PendingAuthUserMarker[] =
      (await firstValueFrom(this.pendingAuthRequestsState.getAll$())) ?? [];

    if (pendingAuthRequestsInState.length > 0) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const pendingAuthRequestsForActiveUser = pendingAuthRequestsInState.some(
        (e) => e.userId === activeUserId,
      );

      if (pendingAuthRequestsForActiveUser) {
        this.messagingService.send("openLoginApproval");
      }
    }
  }
}
