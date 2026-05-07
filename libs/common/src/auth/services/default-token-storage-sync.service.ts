import { Subscription, combineLatest, filter, firstValueFrom, from, switchMap } from "rxjs";
import { Opaque } from "type-fest";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";

import { KeyGenerationService } from "../../key-management/crypto";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../key-management/crypto/models/enc-string";
import { VaultTimeoutAction, VaultTimeoutStringType } from "../../key-management/vault-timeout";
import { VaultTimeoutSettingsService } from "../../key-management/vault-timeout/abstractions/vault-timeout-settings.service";
import { VaultTimeout } from "../../key-management/vault-timeout/types/vault-timeout.type";
import { LogService } from "../../platform/abstractions/log.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { GlobalState, GlobalStateProvider, SingleUserStateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";
import { AccountService } from "../abstractions/account.service";
import { TokenStorageSyncService as TokenStorageSyncServiceAbstraction } from "../abstractions/token-storage-sync.service";
import { TokenService } from "../abstractions/token.service";

import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  TOKEN_STORAGE_HYDRATED,
} from "./token.state";

/** Opaque type for the per-user symmetric key used to encrypt the access token on disk. */
type AccessTokenKey = Opaque<SymmetricCryptoKey, "AccessTokenKey">;

export class DefaultTokenStorageSyncService implements TokenStorageSyncServiceAbstraction {
  private readonly accessTokenKeySecureStorageKey = "_accessTokenKey";
  private readonly refreshTokenSecureStorageKey = "_refreshToken";

  /**
   * Active per-user disk sync subscriptions. Populated by {@link startAccountSubscriptions}
   * and torn down as accounts log out. Stored as a field (not a local) so that a future
   * destroy()/ngOnDestroy hook could unsubscribe all entries if needed.
   */
  private readonly perUserSubscriptions = new Map<UserId, Subscription>();

  /**
   * Per-user "last successfully written to disk" plaintext access token. The combineLatest
   * fan-out fires {@link writeTokensToDisk} on every emission of any source observable;
   * without this cache an access-token rotation would re-encrypt the unchanged plaintext
   * under a fresh IV and re-write `ACCESS_TOKEN_DISK` on every emission.
   *
   * Cleared on encrypt/save failure (so the next attempt retries) and on
   * {@link clearTokensFromDisk} (logout, vault-timeout-driven wipe).
   */
  private readonly lastWrittenAccessTokenByUser = new Map<UserId, string>();

  /**
   * Per-user "last successfully written to OS secure storage" plaintext refresh token.
   * Mirrors {@link lastWrittenAccessTokenByUser} for the secure-storage refresh-token
   * path so we don't re-save and verify-after-save the same value on every combineLatest
   * emission.
   */
  private readonly lastWrittenRefreshTokenByUser = new Map<UserId, string | null>();

  private readonly hydratedState: GlobalState<boolean>;

  constructor(
    private readonly tokenService: TokenService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly accountService: AccountService,
    private readonly singleUserStateProvider: SingleUserStateProvider,
    globalStateProvider: GlobalStateProvider,
    private readonly secureStorageService: AbstractStorageService,
    private readonly encryptService: EncryptService,
    private readonly keyGenerationService: KeyGenerationService,
    private readonly platformSupportsSecureStorage: boolean,
    private readonly logService: LogService,
    private readonly logoutCallback: (reason: LogoutReason, userId: UserId) => Promise<void>,
  ) {
    this.hydratedState = globalStateProvider.get(TOKEN_STORAGE_HYDRATED);
  }

  async init(): Promise<void> {
    // Skip re-hydrate when memory is already populated (MV3 SW respawn).
    const alreadyHydrated = await firstValueFrom(this.hydratedState.state$);
    if (!alreadyHydrated) {
      await this.hydrateAllAccounts();
      await this.hydratedState.update(() => true);
    }
    // Always (re)wire — perUserSubscriptions is per-instance.
    this.startAccountSubscriptions();
  }

  async waitForHydration(): Promise<void> {
    await firstValueFrom(this.hydratedState.state$.pipe(filter((v): v is true => v === true)));
  }

  /**
   * Hydrates memory for every account known at startup. Must complete before any token
   * reads are served or subscriptions start.
   */
  private async hydrateAllAccounts(): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    for (const userId of Object.keys(accounts ?? {})) {
      await this.hydrateOrClear(userId as UserId);
    }
  }

  /**
   * Decides whether a known account's persistent storage should be hydrated into memory
   * or cleared via {@link clearTokensFromDisk}.
   *
   * If the disk access token is missing for an account that's still in `accounts$`,
   * a previous logout left orphan state (refresh token in OS secure storage, client ID /
   * secret in JSON disk, AT key in OS secure storage) — `clearOn: ["logout"]` cleared
   * memory but `clearTokensFromDisk` did not finish. Without this clear pass, the next
   * session would hydrate those orphans as live credentials.
   */
  private async hydrateOrClear(userId: UserId): Promise<void> {
    const diskAccessToken = await firstValueFrom(
      this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$,
    );
    if (!diskAccessToken) {
      await this.clearTokensFromDisk(userId);
      return;
    }
    await this.hydrateMemoryFromPersistentStorage(userId);
  }

  /**
   * Subscribes to account changes and manages per-user disk sync subscriptions.
   *
   * `accounts$` replays the current snapshot on subscription, so the initial emission
   * covers all accounts just hydrated in {@link hydrateAllAccounts} — no separate
   * handling needed for "existing at startup" vs "newly authenticated". Subsequent
   * emissions handle accounts added or removed during the session.
   *
   * Teardown is managed explicitly via {@link perUserSubscriptions}; no `takeUntil`
   * signal is needed inside {@link createSyncSubscription} because `StateProvider` `state$`
   * observables never complete on logout — they emit `null` when state is cleared but
   * the stream stays live.
   */
  private startAccountSubscriptions(): void {
    this.accountService.accounts$.subscribe((accounts) => {
      const activeUserIds = new Set(Object.keys(accounts ?? {}));
      // Start subscriptions for any account that doesn't have one yet.
      for (const userId of activeUserIds) {
        if (!this.perUserSubscriptions.has(userId as UserId)) {
          this.perUserSubscriptions.set(
            userId as UserId,
            this.createSyncSubscription(userId as UserId),
          );
        }
      }
      // Tear down subscriptions for accounts that have logged out.
      for (const [userId, subscription] of this.perUserSubscriptions) {
        if (!activeUserIds.has(userId)) {
          subscription.unsubscribe();
          this.perUserSubscriptions.delete(userId);
        }
      }
    });
  }

  /**
   * Hydrates the refresh token into memory.
   *
   * On secure-storage platforms the refresh token normally lives in OS secure storage, but
   * `writeTokensToDisk` falls back to {@link REFRESH_TOKEN_DISK} when secure storage `save`
   * fails (e.g. intermittent Windows 10/11 failures). To honor that fallback across app
   * restarts we read OS secure storage first, then fall back to the disk JSON copy.
   *
   * If the secure storage read itself throws, we fire the logout callback so the owning
   * context can drive the user-facing dialog. Most often hits Linux distros without a
   * configured secure storage provider.
   */
  private async hydrateRefreshToken(userId: UserId): Promise<void> {
    if (this.platformSupportsSecureStorage) {
      let secureRefreshToken: string | null = null;
      try {
        secureRefreshToken = await this.secureStorageService.get<string>(
          `${userId}${this.refreshTokenSecureStorageKey}`,
          this.getSecureStorageOptions(userId),
        );
      } catch (e) {
        this.logService.error(
          "[TokenStorageSyncService] Failed to read refresh token from secure storage. Logging user out.",
          e,
        );
        await this.logoutCallback("refreshTokenSecureStorageRetrievalFailure", userId);
        return;
      }

      if (secureRefreshToken) {
        await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_MEMORY)
          .update((_) => secureRefreshToken);
        return;
      }
    }

    // Fallback: REFRESH_TOKEN_DISK on every platform.
    //   - Non-secure-storage platforms: this is the primary location.
    //   - Secure-storage platforms: covers writeTokensToDisk's secure-storage-save-failed
    //     fallback, plus pre-secure-storage-migration users.
    const diskRefreshToken = await firstValueFrom(
      this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).state$,
    );
    if (diskRefreshToken) {
      await this.singleUserStateProvider
        .get(userId, REFRESH_TOKEN_MEMORY)
        .update((_) => diskRefreshToken);
    }
  }

  /**
   * Hydrates the access token into memory on a secure-storage platform.
   *
   * The disk copy is normally encrypted with a per-user `AccessTokenKey` stored in OS
   * secure storage. If the key is unrecoverable (secure storage throws or returns null)
   * while the disk copy is encrypted, or if decryption itself throws, we fire the logout
   * callback so the owning context can drive the user-facing "you've been logged out"
   * UX. A plaintext token on disk — produced by the encrypt-failure fallback in
   * `writeTokensToDisk` — is hydrated as-is and never triggers logout.
   */
  private async hydrateAccessTokenOnSecureStoragePlatform(userId: UserId): Promise<void> {
    const diskAccessToken = await firstValueFrom(
      this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$,
    );
    if (!diskAccessToken) {
      return;
    }

    const diskAccessTokenIsEncrypted = EncString.isSerializedEncString(diskAccessToken);

    let accessTokenKey: AccessTokenKey | null;
    try {
      accessTokenKey = await this.getAccessTokenKey(userId);
    } catch (e) {
      if (diskAccessTokenIsEncrypted) {
        this.logService.error(
          "[TokenStorageSyncService] Access token key retrieval failed; cannot decrypt encrypted access token. Logging user out.",
          e,
        );
        await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);
        return;
      }
      // Token on disk is plaintext and key retrieval threw — typically Linux distros
      // without a configured secure storage provider.
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_MEMORY)
        .update((_) => diskAccessToken);
      return;
    }

    if (!diskAccessTokenIsEncrypted) {
      // Plaintext access token on disk — the encrypt-failure fallback path produced by
      // writeTokensToDisk when getOrCreateAccessTokenKey or encryption throws.
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_MEMORY)
        .update((_) => diskAccessToken);
      return;
    }

    if (!accessTokenKey) {
      this.logService.error(
        "[TokenStorageSyncService] Access token key not found in secure storage; cannot decrypt encrypted access token. Logging user out.",
      );
      await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);
      return;
    }

    try {
      const encString = new EncString(diskAccessToken as EncryptedString);
      const decryptedAccessToken = await this.encryptService.decryptString(
        encString,
        accessTokenKey,
      );

      // Decryption can resolve to a falsy value (null/empty string) without throwing —
      // typically when the access token key is mismatched against the ciphertext (e.g.
      // master-password change on another device invalidated the disk-stored encrypted
      // token). Throw so the catch below fires the logout signal rather than letting a
      // falsy value flow into memory unchecked.
      if (!decryptedAccessToken) {
        throw new Error(
          "Access token decryption produced a falsy value. The access token key may be invalid or expired.",
        );
      }
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_MEMORY)
        .update((_) => decryptedAccessToken);
    } catch (e) {
      this.logService.error(
        "[TokenStorageSyncService] Failed to decrypt access token. Logging user out.",
        e,
      );
      await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);
    }
  }

  /**
   * Reads tokens from the persistent tier for a single user, decrypts where necessary,
   * and writes plaintext directly into the memory state keys via `SingleUserStateProvider`.
   *
   * Direct state writes are used (not `TokenService.setXxx`) to avoid triggering the token
   * observables, which would cause the `combineLatest` sync subscription to fire a disk
   * write immediately after hydration.
   */
  private async hydrateMemoryFromPersistentStorage(userId: UserId): Promise<void> {
    // Access token
    if (this.platformSupportsSecureStorage) {
      await this.hydrateAccessTokenOnSecureStoragePlatform(userId);
    } else {
      const accessToken = await firstValueFrom(
        this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$,
      );
      if (accessToken) {
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_MEMORY)
          .update((_) => accessToken);
      }
    }

    // Refresh token
    await this.hydrateRefreshToken(userId);

    // Client ID and client secret: plaintext in JSON disk state on all platforms.
    const clientId = await firstValueFrom(
      this.singleUserStateProvider.get(userId, API_KEY_CLIENT_ID_DISK).state$,
    );
    if (clientId) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_MEMORY)
        .update((_) => clientId);
    }

    const clientSecret = await firstValueFrom(
      this.singleUserStateProvider.get(userId, API_KEY_CLIENT_SECRET_DISK).state$,
    );
    if (clientSecret) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_MEMORY)
        .update((_) => clientSecret);
    }
  }

  /**
   * Creates and returns a `Subscription` that watches all tokens and vault timeout settings
   * for the given user and keeps disk state in sync.
   *
   * `switchMap` is used to cancel any in-flight disk write when a new emission arrives,
   * coalescing the burst of state changes from a single `setTokens` call into one effective
   * disk write with the final values.
   *
   * The returned `Subscription` is stored in {@link perUserSubscriptions} and unsubscribed
   * explicitly when the account logs out — no `takeUntil` is needed.
   */
  private createSyncSubscription(userId: UserId): Subscription {
    return combineLatest([
      this.tokenService.accessToken$(userId),
      this.tokenService.refreshToken$(userId),
      this.tokenService.clientId$(userId),
      this.tokenService.clientSecret$(userId),
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    ])
      .pipe(
        switchMap(([accessToken, refreshToken, clientId, clientSecret, action, timeout]) =>
          from(
            this.syncTokenStorage(
              userId,
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              action,
              timeout,
            ),
          ),
        ),
      )
      .subscribe({
        error: (e: unknown) =>
          this.logService.error(`[TokenStorageSyncService] syncForUser error for ${userId}`, e),
      });
  }

  /**
   * Dispatches to {@link writeTokensToDisk} or {@link clearTokensFromDisk} based on the
   * security invariant.
   *
   * A null access token means the user has logged out — disk is wiped unconditionally
   * regardless of vault timeout action, since no credentials should persist after logout.
   */
  private async syncTokenStorage(
    userId: UserId,
    accessToken: string | null,
    refreshToken: string | null,
    clientId: string | null,
    clientSecret: string | null,
    action: VaultTimeoutAction,
    timeout: VaultTimeout,
  ): Promise<void> {
    if (!accessToken) {
      await this.clearTokensFromDisk(userId);
      return;
    }
    if (this.shouldPersistToDisk(action, timeout)) {
      await this.writeTokensToDisk(userId, accessToken, refreshToken, clientId, clientSecret);
    } else {
      await this.clearTokensFromDisk(userId);
    }
  }

  /**
   * Returns `true` when tokens should be written to the persistent tier.
   *
   * Security invariant: LogOut + non-Never timeout → wipe disk. All other combinations
   * (Lock, or LogOut + Never) → persist to disk.
   */
  private shouldPersistToDisk(action: VaultTimeoutAction, timeout: VaultTimeout): boolean {
    return !(action === VaultTimeoutAction.LogOut && timeout !== VaultTimeoutStringType.Never);
  }

  /**
   * Persists all tokens for the given user to the appropriate storage tier. Per-token
   * details (encrypt path, fallback paths, dedup caches) live in the helpers below.
   */
  private async writeTokensToDisk(
    userId: UserId,
    accessToken: string,
    refreshToken: string | null,
    clientId: string | null,
    clientSecret: string | null,
  ): Promise<void> {
    await this.writeAccessTokenToDisk(userId, accessToken);
    await this.writeRefreshTokenToDisk(userId, refreshToken);
    await this.writeClientCredentialsToDisk(userId, clientId, clientSecret);
  }

  /**
   * Writes the access token to its persistent location. On secure-storage platforms it's
   * encrypted with a per-user `AccessTokenKey` and the ciphertext is written to
   * {@link ACCESS_TOKEN_DISK}; on encrypt failure (e.g. Linux without a configured
   * secure-storage provider) we fall back to plaintext on the same key. Non-secure-storage
   * platforms always write plaintext. Hydration uses {@link EncString.isSerializedEncString}
   * on the read side to distinguish the two formats.
   *
   * Skips the entire write when the plaintext matches the last successfully persisted
   * value — EncString re-encryption produces a fresh IV every call, so the state framework's
   * `shouldUpdate: prev !== new` guard can't catch the no-op on its own.
   */
  private async writeAccessTokenToDisk(userId: UserId, accessToken: string): Promise<void> {
    if (this.lastWrittenAccessTokenByUser.get(userId) === accessToken) {
      return;
    }

    if (!this.platformSupportsSecureStorage) {
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_DISK)
        .update((_) => accessToken, { shouldUpdate: (prev) => prev !== accessToken });
      this.lastWrittenAccessTokenByUser.set(userId, accessToken);
      return;
    }

    try {
      const accessTokenKey = await this.getOrCreateAccessTokenKey(userId);
      const encrypted = await this.encryptService.encryptString(accessToken, accessTokenKey);
      // TODO: IN SCOPE: this should error if `encrypted.encryptedString` is undefined
      const typeSafeEncrypted = encrypted.encryptedString ?? null;
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_DISK)
        .update((_) => typeSafeEncrypted, {
          shouldUpdate: (prev) => prev !== typeSafeEncrypted,
        });
      this.lastWrittenAccessTokenByUser.set(userId, accessToken);
    } catch (e) {
      this.logService.error(
        "[TokenStorageSyncService] Failed to encrypt access token for disk. Falling back to plaintext.",
        e,
      );
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_DISK)
        .update((_) => accessToken, { shouldUpdate: (prev) => prev !== accessToken });
      // Invalidate the cache so the next emission re-attempts the encrypt path
      // (e.g. once secure storage / key generation recovers).
      this.lastWrittenAccessTokenByUser.delete(userId);
    }
  }

  /**
   * Writes the refresh token to its persistent location. On secure-storage platforms it's
   * saved to OS secure storage with a verify-after-save read-back (Windows 10/11 silent-
   * failure mitigation) and the disk JSON copy is cleared. On any failure — or on non-
   * secure-storage platforms — we write plaintext to {@link REFRESH_TOKEN_DISK}.
   *
   * Skips the secure-storage save+verify when the value matches the last successfully
   * persisted refresh token. Without this guard every combineLatest emission would
   * round-trip OS secure storage. The state-framework `shouldUpdate` guard already
   * handles dedup on the JSON-disk path, so no JS cache is needed there.
   */
  private async writeRefreshTokenToDisk(
    userId: UserId,
    refreshToken: string | null,
  ): Promise<void> {
    if (!this.platformSupportsSecureStorage) {
      await this.singleUserStateProvider
        .get(userId, REFRESH_TOKEN_DISK)
        .update((_) => refreshToken, { shouldUpdate: (prev) => prev !== refreshToken });
      return;
    }

    if (this.lastWrittenRefreshTokenByUser.get(userId) === refreshToken) {
      return;
    }

    try {
      await this.saveRefreshTokenToSecureStorage(userId, refreshToken);
      // On secure-storage platforms the refresh token lives in OS secure storage only —
      // clear the JSON disk slot so only one location holds the value at a time.
      await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null, {
        shouldUpdate: (prev) => prev !== null,
      });
      this.lastWrittenRefreshTokenByUser.set(userId, refreshToken);
    } catch (e) {
      this.logService.error(
        "[TokenStorageSyncService] Failed to save refresh token to secure storage. Falling back to disk.",
        e,
      );
      await this.singleUserStateProvider
        .get(userId, REFRESH_TOKEN_DISK)
        .update((_) => refreshToken, { shouldUpdate: (prev) => prev !== refreshToken });
      this.lastWrittenRefreshTokenByUser.delete(userId);
    }
  }

  /**
   * Saves the refresh token to OS secure storage and verifies it persisted via a read-back.
   * Throws if the read-back returns nothing — we've observed `save()` resolving without
   * error on Windows 10/11 while the value never actually lands in secure storage. The
   * throw lets the caller fall back to the JSON disk location.
   */
  private async saveRefreshTokenToSecureStorage(
    userId: UserId,
    refreshToken: string | null,
  ): Promise<void> {
    if (refreshToken == null) {
      return;
    }
    await this.secureStorageService.save<string>(
      `${userId}${this.refreshTokenSecureStorageKey}`,
      refreshToken,
      this.getSecureStorageOptions(userId),
    );
    const persisted = await this.secureStorageService.get<string>(
      `${userId}${this.refreshTokenSecureStorageKey}`,
      this.getSecureStorageOptions(userId),
    );
    if (!persisted) {
      throw new Error("Refresh token unable to be retrieved from secure storage after save.");
    }
  }

  private async writeClientCredentialsToDisk(
    userId: UserId,
    clientId: string | null,
    clientSecret: string | null,
  ): Promise<void> {
    await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_ID_DISK)
      .update((_) => clientId ?? null, { shouldUpdate: (prev) => prev !== (clientId ?? null) });

    await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_SECRET_DISK)
      .update((_) => clientSecret ?? null, {
        shouldUpdate: (prev) => prev !== (clientSecret ?? null),
      });
  }

  async clearTokensFromDisk(userId: UserId): Promise<void> {
    await Promise.all([
      this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_DISK)
        .update((_) => null, { shouldUpdate: (prev) => prev !== null }),
      this.singleUserStateProvider
        .get(userId, REFRESH_TOKEN_DISK)
        .update((_) => null, { shouldUpdate: (prev) => prev !== null }),
      this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_DISK)
        .update((_) => null, { shouldUpdate: (prev) => prev !== null }),
      this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_DISK)
        .update((_) => null, { shouldUpdate: (prev) => prev !== null }),
    ]);

    if (this.platformSupportsSecureStorage) {
      await this.secureStorageService
        .remove(
          `${userId}${this.accessTokenKeySecureStorageKey}`,
          this.getSecureStorageOptions(userId),
        )
        .catch((e) =>
          this.logService.error(
            "[TokenStorageSyncService] Failed to remove access token key from secure storage",
            e,
          ),
        );
      await this.secureStorageService
        .remove(
          `${userId}${this.refreshTokenSecureStorageKey}`,
          this.getSecureStorageOptions(userId),
        )
        .catch((e) =>
          this.logService.error(
            "[TokenStorageSyncService] Failed to remove refresh token from secure storage",
            e,
          ),
        );
    }

    // Invalidate the dedup caches so the next emission re-writes from scratch.
    this.lastWrittenAccessTokenByUser.delete(userId);
    this.lastWrittenRefreshTokenByUser.delete(userId);
  }

  /**
   * Retrieves the access token encryption key for the given user from OS secure storage.
   * Returns `null` if no key has been stored yet.
   */
  private async getAccessTokenKey(userId: UserId): Promise<AccessTokenKey | null> {
    const keyJson = await this.secureStorageService.get<ReturnType<SymmetricCryptoKey["toJSON"]>>(
      `${userId}${this.accessTokenKeySecureStorageKey}`,
      this.getSecureStorageOptions(userId),
    );
    if (!keyJson) {
      return null;
    }
    return SymmetricCryptoKey.fromJSON(keyJson) as AccessTokenKey;
  }

  /**
   * Returns the access token encryption key for the given user, creating and persisting
   * a new 512-bit key if one does not already exist.
   *
   * After saving a new key, the write is verified by reading it back — intermittent save
   * failures have been observed on Windows 10/11. Throws if the key cannot be retrieved
   * after being saved.
   *
   * @throws If the platform does not support secure storage.
   * @throws If the key cannot be retrieved from secure storage after being saved.
   */
  private async getOrCreateAccessTokenKey(userId: UserId): Promise<AccessTokenKey> {
    if (!this.platformSupportsSecureStorage) {
      throw new Error("Platform does not support secure storage. Cannot obtain access token key.");
    }

    // First see if we have an accessTokenKey in secure storage and return it if we do
    // Note: retrieving/saving data from/to secure storage on linux will throw if the
    // distro doesn't have a secure storage provider
    let accessTokenKey = await this.getAccessTokenKey(userId);

    if (!accessTokenKey) {
      // Otherwise, create a new one and save it to secure storage, then return it
      accessTokenKey = (await this.keyGenerationService.createKey(512)) as AccessTokenKey;
      await this.secureStorageService.save<AccessTokenKey>(
        `${userId}${this.accessTokenKeySecureStorageKey}`,
        accessTokenKey,
        this.getSecureStorageOptions(userId),
      );

      // We are having intermittent issues with access token keys not saving into secure storage on windows 10/11.
      // So, let's add a check to ensure we can read the value after writing it.
      const savedAccessTokenKey = await this.getAccessTokenKey(userId);
      if (!savedAccessTokenKey) {
        throw new Error("Access token key unable to be retrieved from secure storage after save.");
      }
    }
    return accessTokenKey;
  }

  /** Builds the `StorageOptions` for OS secure storage operations for the given user. */
  private getSecureStorageOptions(userId: UserId): StorageOptions {
    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId: userId,
    };
  }
}
