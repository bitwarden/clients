import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LockService } from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId, SharedUnlockDriver, SymmetricKey } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";
import { UserId as TSUserId } from "@bitwarden/user-core";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid, uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserKey } from "../../types/key";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

function fromSdkUserId(userId: UserId): TSUserId {
  return uuidAsString(userId) as TSUserId;
}

/**
 * A driver that exposes client capabilities (lock/unlock, user enumeration, etc.) to the SDK's
 * shared unlock leader/follower.
 */
export class JsSharedUnlockDriver implements SharedUnlockDriver {
  constructor(
    private accountService: AccountService,
    private lockService: LockService,
    private unlockService: UnlockService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
    private sharedUnlockSettingsService: SharedUnlockSettingsService,
    private onExternalUnlock?: (userId: TSUserId) => void,
  ) {}

  async lock_user(user_id: UserId): Promise<void> {
    if (!(await this.sharedUnlockSettingsService.allowSharingUnlockState(fromSdkUserId(user_id)))) {
      return;
    }

    await this.lockService.lock(fromSdkUserId(user_id));
  }

  async unlock_user(user_id: UserId, user_key: SymmetricKey): Promise<void> {
    if (!(await this.sharedUnlockSettingsService.allowSharingUnlockState(fromSdkUserId(user_id)))) {
      return;
    }

    await this.unlockService.unlockWithDecryptedUserKey(
      fromSdkUserId(user_id),
      SymmetricCryptoKey.fromSdk(user_key) as UserKey,
    );
    this.onExternalUnlock?.(fromSdkUserId(user_id));
  }

  async get_user_key(user_id: UserId): Promise<SymmetricKey | undefined> {
    const typedUserId = fromSdkUserId(user_id);
    return (await firstValueFrom(this.keyService.userKey$(typedUserId)))?.toSdk();
  }

  async list_users(): Promise<UserId[]> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    return Object.keys(accounts).map(asUuid<UserId>);
  }

  async suppress_vault_timeout(
    user_id: UserId,
    suppression_duration_milliseconds: number,
  ): Promise<void> {
    const until = Date.now() + suppression_duration_milliseconds;
    await this.vaultTimeoutSettingsService.suppressVaultTimeout(until, fromSdkUserId(user_id));
  }

  async get_client_name(): Promise<string> {
    return this.platformUtilsService.getClientType();
  }

  async get_vault_url(user_id: UserId): Promise<string> {
    const environment = await firstValueFrom(
      this.environmentService.getEnvironment$(fromSdkUserId(user_id)),
    );
    return environment.getWebVaultUrl();
  }
}
