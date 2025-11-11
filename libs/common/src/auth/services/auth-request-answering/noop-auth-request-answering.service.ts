import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class NoopAuthRequestAnsweringService implements AuthRequestAnsweringService {
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
