import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class NoopAuthRequestAnsweringService implements AuthRequestAnsweringService {
  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    // no-op
    throw new Error("userMeetsConditionsToShowApprovalDialog() not implemented for this client");
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent) {} // no-op

  async processPendingAuthRequests(): Promise<void> {} // no-op

  setupUnlockListenersForProcessingAuthRequests(): void {} // no-op
}
