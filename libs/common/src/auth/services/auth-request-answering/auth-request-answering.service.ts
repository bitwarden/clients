import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthServerNotificationTags } from "@bitwarden/common/auth/enums/auth-server-notification-tags";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { getOptionalUserId, getUserId } from "@bitwarden/common/auth/services/account.service";
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
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringServiceAbstraction } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

import { PendingAuthRequestsStateService } from "./pending-auth-requests.state";

export class AuthRequestAnsweringService implements AuthRequestAnsweringServiceAbstraction {
  constructor(
    private readonly accountService: AccountService,
    private readonly actionService: ActionsService,
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
    private readonly masterPasswordService: MasterPasswordServiceAbstraction,
    private readonly messagingService: MessagingService,
    private readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly systemNotificationsService: SystemNotificationsService,
  ) {}

  async receivedPendingAuthRequest(userId: UserId, authRequestId: string): Promise<void> {
    console.debug(
      "[AuthRequestAnsweringService] receivedPendingAuthRequest",
      { userId, authRequestId },
    );
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    const activeUserId: UserId | null = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(userId),
    );
    const popupOpen = await this.platformUtilsService.isPopupOpen();

    console.debug(
      "[AuthRequestAnsweringService] current state",
      { popupOpen, authStatus, activeUserId, forceSetPasswordReason },
    );

    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(userId);

    // These are the conditions we are looking for to know if the extension is in a state to show
    // the approval dialog.
    const conditionsMet =
      popupOpen &&
      authStatus === AuthenticationStatus.Unlocked &&
      activeUserId === userId &&
      forceSetPasswordReason === ForceSetPasswordReason.None;

    if (!conditionsMet) {
      console.debug(
        "[AuthRequestAnsweringService] receivedPendingAuthRequest - Conditions not met, creating system notification",
      );
      // Get the user's email to include in the system notification
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const emailForUser = accounts[userId].email;

      await this.systemNotificationsService.create({
        id: `${AuthServerNotificationTags.AuthRequest}_${authRequestId}`, // the underscore is an important delimiter.
        title: this.i18nService.t("accountAccessRequested"),
        body: this.i18nService.t("confirmAccessAttempt", emailForUser),
        buttons: [],
      });
      return;
    }

    // Popup is open and conditions are met; open dialog immediately for this request
    console.debug("[AuthRequestAnsweringService] receivedPendingAuthRequest - Opening popup.");
    this.messagingService.send("openLoginApproval");
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    if (event.buttonIdentifier === ButtonLocation.NotificationButton) {
      await this.systemNotificationsService.clear({
        id: `${event.id}`,
      });
      await this.actionService.openPopup();
    }
  }

  async processPendingAuthRequests(): Promise<void> {
    // Prune any stale pending requests (older than 15 minutes)
    // This comes from GlobalSettings.cs
    //    public TimeSpan UserRequestExpiration { get; set; } = TimeSpan.FromMinutes(15);
    const fifteenMinutesMs = 15 * 60 * 1000;

    await this.pendingAuthRequestsState.pruneOlderThan(fifteenMinutesMs);

    const pending = (await firstValueFrom(this.pendingAuthRequestsState.getAll$())) ?? [];

    if (pending.length > 0) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const pendingForActive = pending.some((e) => e.userId === activeUserId);

      if (pendingForActive) {
        const isUnlocked =
          (await firstValueFrom(this.authService.authStatusFor$(activeUserId))) ===
          AuthenticationStatus.Unlocked;

        const forceSetPasswordReason = await firstValueFrom(
          this.masterPasswordService.forceSetPasswordReason$(activeUserId),
        );

        if (isUnlocked && forceSetPasswordReason === ForceSetPasswordReason.None) {
          console.debug("[AuthRequestAnsweringService] popupOpened - Opening popup.");
          this.messagingService.send("openLoginApproval");
        }
      }
    }
  }
}
