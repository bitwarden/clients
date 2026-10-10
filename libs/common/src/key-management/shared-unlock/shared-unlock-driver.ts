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
import { SHARED_UNLOCK_DISK, StateProvider, UserKeyDefinition } from "../../platform/state";
import { UserKey } from "../../types/key";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

/**
 * Date (ms since the Unix epoch) of the user's last manual lock. On disk, so a lock made just
 * before a process reload still wins against an older unlock held by a peer.
 */
export const LAST_MANUAL_LOCK = new UserKeyDefinition<number>(
  SHARED_UNLOCK_DISK,
  "lastManualLock",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
    // Prevents the state from caching, so a read right after a reload sees the persisted value.
    cleanupDelayMs: 0,
  },
);

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
    private stateProvider: StateProvider,
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

  async set_last_manual_lock(user_id: UserId, locked_at: number): Promise<void> {
    await this.stateProvider.setUserState(LAST_MANUAL_LOCK, locked_at, fromSdkUserId(user_id));
  }

  async get_last_manual_lock(user_id: UserId): Promise<number | undefined> {
    const lockedAt = await firstValueFrom(
      this.stateProvider.getUserState$(LAST_MANUAL_LOCK, fromSdkUserId(user_id)),
    );
    return lockedAt ?? undefined;
  }
}
