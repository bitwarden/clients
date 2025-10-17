import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { getOptionalUserId, getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

import {
  PendingAuthRequestsStateService,
  PendingAuthUserMarker,
} from "./pending-auth-requests.state";

export class DefaultAuthRequestAnsweringService implements AuthRequestAnsweringService {
  constructor(
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly masterPasswordService: MasterPasswordServiceAbstraction,
    protected readonly messagingService: MessagingService,
    protected readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
  ) {}

  async receivedPendingAuthRequest(userId: UserId): Promise<void> {
    // Always persist the pending marker for this user to global state.
    await this.pendingAuthRequestsState.add(userId);

    const userIsAvailableToViewDialog = await this.userMeetsConditionsToShowApprovalDialog(userId);
    if (userIsAvailableToViewDialog) {
      // Send message to open dialog immediately for this request
      this.messagingService.send("openLoginApproval");
    }
  }

  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    const activeUserId: UserId | null = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(userId),
    );

    const meetsConditions =
      authStatus === AuthenticationStatus.Unlocked &&
      activeUserId === userId &&
      forceSetPasswordReason === ForceSetPasswordReason.None;

    return meetsConditions;
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
