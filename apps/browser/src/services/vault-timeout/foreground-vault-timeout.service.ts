// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MessagingService } from "@bitwarden/common/src/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/src/types/guid";
import { VaultTimeoutService } from "@bitwarden/key-management";

export class ForegroundVaultTimeoutService implements VaultTimeoutService {
  constructor(protected messagingService: MessagingService) {}

  // should only ever run in background
  async checkVaultTimeout(): Promise<void> {}

  async lock(userId?: UserId): Promise<void> {
    this.messagingService.send("lockVault", { userId });
  }

  async logOut(userId?: string): Promise<void> {
    this.messagingService.send("logout", { userId });
  }
}
