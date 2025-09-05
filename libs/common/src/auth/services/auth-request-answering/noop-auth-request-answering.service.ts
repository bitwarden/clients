import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringServiceAbstraction } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class NoopAuthRequestAnsweringService implements AuthRequestAnsweringServiceAbstraction {
  constructor() {}

  async receivedPendingAuthRequest(userId: UserId, notificationId: string): Promise<void> {}

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {}

  async processPendingAuthRequests(): Promise<void> {}
}
