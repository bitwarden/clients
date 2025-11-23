// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { VaultTimeoutService as BaseVaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout/abstractions/vault-timeout.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export class ForegroundVaultTimeoutService implements BaseVaultTimeoutService {
  constructor(protected messagingService: MessagingService) {}

  // should only ever run in background
  async checkVaultTimeout(): Promise<void> {}
}
