import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { UserId, PeerLockState, SharedUnlockDriver, SymmetricKey } from "@bitwarden/sdk-internal";
import { LockService, LockSource, UnlockService } from "@bitwarden/unlock";
import { UserId as TSUserId } from "@bitwarden/user-core";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid, uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { UserKey } from "../../types/key";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

function fromSdkUserId(userId: UserId): TSUserId {
  return uuidAsString(userId) as TSUserId;
}

/**
 * A driver that exposes client capabilities (lock/unlock, user enumeration, etc.) to this device's
 * shared unlock peer.
 */
export class JsSharedUnlockDriver implements SharedUnlockDriver {
  constructor(
    private accountService: AccountService,
    private lockService: LockService,
    private unlockService: UnlockService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
  ) {}

  async lock_user(user_id: UserId): Promise<void> {
    await this.lockService.lock(fromSdkUserId(user_id), LockSource.SharedUnlock);
  }

  async unlock_user(user_id: UserId, user_key: SymmetricKey): Promise<void> {
    await this.unlockService.unlockFromSharedUnlock(
      fromSdkUserId(user_id),
      SymmetricCryptoKey.fromSdk(user_key) as UserKey,
    );
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

  async on_peer_state(user_id: UserId, lock_state: PeerLockState): Promise<void> {
    // no-op: the SDK reports a responding peer's lock state after every accepted sync, but no
    // client consumer exists for it yet. Implemented as an empty stub to satisfy the driver
    // interface; wire this up when a consumer needs to distinguish "a peer answered and is locked"
    // from "no peer answered at all".
  }
}
