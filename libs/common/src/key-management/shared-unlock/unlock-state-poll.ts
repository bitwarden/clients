import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { AccountService } from "../../auth/abstractions/account.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";

/**
 * A poller that checks for all users whether they have transitioned from a locked state to an unlocked state.
 * Note: This is a temporary solution and will be removed as soon as unlock service is rolled out fully.
 */
export class UnlockEventPoller {
  private previousUserKeys = new Map<UserId, SymmetricCryptoKey | null>();

  constructor(
    private keyService: KeyService,
    private accountService: AccountService,
    private onUnlock: (userId: UserId, userKey: SymmetricCryptoKey) => Promise<void>,
  ) {}

  async poll(): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const accountIds = Object.keys(accounts) as UserId[];

    for (const accountId of accountIds) {
      const accountUserKey = await firstValueFrom(this.keyService.userKey$(accountId));
      const previousUserKey = this.previousUserKeys.get(accountId) ?? null;

      if (previousUserKey == null && accountUserKey != null) {
        await this.onUnlock(accountId, accountUserKey);
      }
      this.previousUserKeys.set(accountId, accountUserKey);
    }

    for (const trackedUserId of this.previousUserKeys.keys()) {
      if (!accountIds.includes(trackedUserId)) {
        this.previousUserKeys.delete(trackedUserId);
      }
    }
  }
}

// Note: This will be removed once all unlock flows route through UnlockService
export function pollForUnlockEvents(
  keyService: KeyService,
  accountService: AccountService,
  onUnlock: (userId: UserId, userKey: SymmetricCryptoKey) => Promise<void>,
): () => void {
  const poller = new UnlockEventPoller(keyService, accountService, onUnlock);
  // Polling fallback for unlock flows that do not yet route through UnlockService.
  // Once every unlock path goes through UnlockService, this interval can be removed.
  const handle = setInterval(async () => {
    await poller.poll();
  }, 100);

  return () => clearInterval(handle);
}
