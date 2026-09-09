import { filter, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import {
  VAULT_TIMEOUT,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider, StateService } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { AutoUnlockService } from "./auto-unlock.service";

export class DefaultAutoUnlockService implements AutoUnlockService {
  constructor(
    private keyService: KeyService,
    private stateService: StateService,
    private stateProvider: StateProvider,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
  ) {}

  async getAutoUnlockKey(userId: UserId): Promise<UserKey | null> {
    const autoUnlockKeyB64 = await this.stateService.getUserKeyAutoUnlock({ userId: userId });
    if (autoUnlockKeyB64 == null) {
      return null;
    }

    const autoUnlockKey = new SymmetricCryptoKey(Utils.fromB64ToArray(autoUnlockKeyB64)) as UserKey;

    if (!(await this.keyService.validateUserKey(autoUnlockKey, userId))) {
      this.logService.warning("Invalid key, throwing away stored keys");
      await this.keyService.clearAllStoredUserKeys(userId);
      return null;
    }

    return autoUnlockKey;
  }

  async setAutoUnlockKey(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    if (await this.shouldStoreAutoUnlockKey(userId)) {
      await this.stateService.setUserKeyAutoUnlock(userKey.toBase64(), { userId: userId });
    } else {
      await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    }
  }

  async refreshAutoUnlockKey(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("UserId is required.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("No user key found for: " + userId);
    }

    await this.setAutoUnlockKey(userId, userKey);
  }

  private async shouldStoreAutoUnlockKey(userId: UserId): Promise<boolean> {
    // Cli has fixed Never vault timeout, and it should not be affected by a policy.
    if (this.platformUtilsService.getClientType() === ClientType.Cli) {
      return true;
    }

    const vaultTimeout = await firstValueFrom(
      this.stateProvider
        .getUserState$(VAULT_TIMEOUT, userId)
        .pipe(filter((timeout) => timeout != null)),
    );

    this.logService.debug(
      `[AutoUnlockService] Should store never-lock key for vault timeout ${vaultTimeout}`,
    );

    return vaultTimeout === VaultTimeoutStringType.Never;
  }
}
