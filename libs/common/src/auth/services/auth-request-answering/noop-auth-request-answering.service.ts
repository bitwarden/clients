import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class NoopAuthRequestAnsweringService implements AuthRequestAnsweringService {
  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    throw new Error("userMeetsConditionsToShowApprovalDialog() not implemented for this client");
  }
  setupUnlockListenersForProcessingAuthRequests(): void {}
}
