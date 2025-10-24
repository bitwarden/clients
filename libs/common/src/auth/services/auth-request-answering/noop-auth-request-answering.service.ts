import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class NoopAuthRequestAnsweringService implements AuthRequestAnsweringService {
  constructor() {}

  async receivedPendingAuthRequest(userId: UserId, notificationId: string): Promise<void> {}

  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    throw new Error("userMeetsConditionsToShowApprovalDialog() not implemented for this client");
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent) {}

  async processPendingAuthRequests(): Promise<void> {}

  setupUnlockListenersForProcessingAuthRequests(): void {}
}
