import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringServiceAbstraction } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class UnsupportedAuthRequestAnsweringService
  implements AuthRequestAnsweringServiceAbstraction
{
  constructor() {}
  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    throw new Error("Received pending auth request not supported.");
  }

  async receivedPendingAuthRequest(userId: UserId, notificationId: string): Promise<void> {
    throw new Error("Received pending auth request not supported.");
  }
}
