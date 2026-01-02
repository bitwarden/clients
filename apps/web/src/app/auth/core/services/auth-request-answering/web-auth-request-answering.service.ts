import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DefaultAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/default-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

export class WebAuthRequestAnsweringService
  extends DefaultAuthRequestAnsweringService
  implements AuthRequestAnsweringService
{
  constructor(
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly masterPasswordService: MasterPasswordServiceAbstraction,
    protected readonly messagingService: MessagingService,
    protected readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
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
    this.messagingService.send("openLoginApproval", {
      // Include the authRequestId so the DeviceManagementComponent can upsert the correct device.
      // This will only matter if the user is on the /device-management screen when the auth request is received.
      notificationId: authRequestId,
    });
  }

  async activeUserMeetsConditionsToShowApprovalDialog(authRequestUserId: UserId): Promise<boolean> {
    throw new Error(
      "activeUserMeetsConditionsToShowApprovalDialog() not implemented for this client",
    );
  }

  setupUnlockListenersForProcessingAuthRequests(): void {
    throw new Error(
      "setupUnlockListenersForProcessingAuthRequests() not implemented for this client",
    );
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    throw new Error("handleAuthRequestNotificationClicked() not implemented for this client");
  }
}
