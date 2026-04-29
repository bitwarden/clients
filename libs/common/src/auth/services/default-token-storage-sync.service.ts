import { Subscription, combineLatest, firstValueFrom, from, switchMap } from "rxjs";
import { Opaque } from "type-fest";

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
import { SingleUserStateProvider } from "../../platform/state";
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

  constructor(
    private readonly tokenService: TokenService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly accountService: AccountService,
    private readonly singleUserStateProvider: SingleUserStateProvider,
    private readonly secureStorageService: AbstractStorageService,
    private readonly encryptService: EncryptService,
    private readonly keyGenerationService: KeyGenerationService,
    private readonly platformSupportsSecureStorage: boolean,
    private readonly logService: LogService,
  ) {}

  async init(): Promise<void> {
    await this.hydrateAllAccounts();
    this.startAccountSubscriptions();
  }

  /**
   * Hydrates memory for every account known at startup. Must complete before any token
   * reads are served or subscriptions start.
   */
  private async hydrateAllAccounts(): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    for (const userId of Object.keys(accounts ?? {})) {
      await this.hydrateMemoryFromPersistentStorage(userId as UserId);
    }
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
      const encryptedAccessToken = await firstValueFrom(
        this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$,
      );
      if (encryptedAccessToken) {
        try {
          const key = await this.getAccessTokenKey(userId);
          if (key && EncString.isSerializedEncString(encryptedAccessToken)) {
            const encString = new EncString(encryptedAccessToken as EncryptedString);
            const plaintext = await this.encryptService.decryptString(encString, key);
            await this.singleUserStateProvider
              .get(userId, ACCESS_TOKEN_MEMORY)
              .update((_) => plaintext);
          } else if (!EncString.isSerializedEncString(encryptedAccessToken)) {
            // Pre-migration: unencrypted access token on disk
            await this.singleUserStateProvider
              .get(userId, ACCESS_TOKEN_MEMORY)
              .update((_) => encryptedAccessToken);
          }
        } catch (e) {
          this.logService.error("[TokenStorageSyncService] Failed to decrypt access token", e);
        }
      }
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
    if (this.platformSupportsSecureStorage) {
      try {
        const refreshToken = await this.secureStorageService.get<string>(
          `${userId}${this.refreshTokenSecureStorageKey}`,
          this.getSecureStorageOptions(userId),
        );
        if (refreshToken) {
          await this.singleUserStateProvider
            .get(userId, REFRESH_TOKEN_MEMORY)
            .update((_) => refreshToken);
        }
      } catch (e) {
        this.logService.error(
          "[TokenStorageSyncService] Failed to read refresh token from secure storage",
          e,
        );
      }
    } else {
      const refreshToken = await firstValueFrom(
        this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).state$,
      );
      if (refreshToken) {
        await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_MEMORY)
          .update((_) => refreshToken);
      }
    }

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
   * Dispatches to {@link writeTokensToDisk} or {@link wipeTokensFromDisk} based on the
   * security invariant. A null access token means the user is logged out — disk is already
   * cleared by `TokenService.clearTokens()`, so no action is taken.
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
      return;
    }
    if (this.shouldPersistToDisk(action, timeout)) {
      await this.writeTokensToDisk(userId, accessToken, refreshToken, clientId, clientSecret);
    } else {
      await this.wipeTokensFromDisk(userId);
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
   * Persists all tokens for the given user to the appropriate storage tier.
   *
   * - Access token: encrypted via {@link getOrCreateAccessTokenKey} on secure storage
   *   platforms; stored as plaintext JSON otherwise. Falls back to plaintext on encrypt failure.
   * - Refresh token: saved to OS secure storage on secure storage platforms (JSON disk
   *   location is cleared); stored as plaintext JSON otherwise. Falls back to plaintext
   *   JSON on secure storage save failure.
   * - Client ID / secret: plaintext JSON on all platforms.
   */
  private async writeTokensToDisk(
    userId: UserId,
    accessToken: string,
    refreshToken: string | null,
    clientId: string | null,
    clientSecret: string | null,
  ): Promise<void> {
    // Access token
    if (this.platformSupportsSecureStorage) {
      try {
        const key = await this.getOrCreateAccessTokenKey(userId);
        const encryptedAccessToken = await this.encryptService.encryptString(accessToken, key);
        const encryptedString = encryptedAccessToken.encryptedString ?? null;
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_DISK)
          .update((_) => encryptedString, {
            shouldUpdate: (prev) => prev !== encryptedString,
          });
      } catch (e) {
        this.logService.error(
          "[TokenStorageSyncService] Failed to encrypt access token for disk. Falling back to plaintext.",
          e,
        );
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_DISK)
          .update((_) => accessToken, { shouldUpdate: (prev) => prev !== accessToken });
      }
    } else {
      await this.singleUserStateProvider
        .get(userId, ACCESS_TOKEN_DISK)
        .update((_) => accessToken, { shouldUpdate: (prev) => prev !== accessToken });
    }

    // Refresh token
    if (this.platformSupportsSecureStorage) {
      try {
        if (refreshToken != null) {
          await this.secureStorageService.save<string>(
            `${userId}${this.refreshTokenSecureStorageKey}`,
            refreshToken,
            this.getSecureStorageOptions(userId),
          );
        }
        // Clear disk location — on secure storage platforms the refresh token lives in OS secure storage only
        await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null, {
          shouldUpdate: (prev) => prev !== null,
        });
      } catch (e) {
        this.logService.error(
          "[TokenStorageSyncService] Failed to save refresh token to secure storage. Falling back to disk.",
          e,
        );
        await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_DISK)
          .update((_) => refreshToken, { shouldUpdate: (prev) => prev !== refreshToken });
      }
    } else {
      await this.singleUserStateProvider
        .get(userId, REFRESH_TOKEN_DISK)
        .update((_) => refreshToken, { shouldUpdate: (prev) => prev !== refreshToken });
    }

    // Client ID and client secret: plaintext on all platforms
    await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_ID_DISK)
      .update((_) => clientId ?? null, { shouldUpdate: (prev) => prev !== (clientId ?? null) });

    await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_SECRET_DISK)
      .update((_) => clientSecret ?? null, {
        shouldUpdate: (prev) => prev !== (clientSecret ?? null),
      });
  }

  /**
   * Clears all token storage locations for the given user.
   *
   * JSON disk state keys are cleared on all platforms. On secure storage platforms,
   * the access token key and refresh token are also removed from OS secure storage.
   * Secure storage remove failures are logged but do not throw.
   */
  private async wipeTokensFromDisk(userId: UserId): Promise<void> {
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

    let key = await this.getAccessTokenKey(userId);
    if (!key) {
      key = (await this.keyGenerationService.createKey(512)) as AccessTokenKey;
      await this.secureStorageService.save<AccessTokenKey>(
        `${userId}${this.accessTokenKeySecureStorageKey}`,
        key,
        this.getSecureStorageOptions(userId),
      );
      const saved = await this.getAccessTokenKey(userId);
      if (!saved) {
        throw new Error("Access token key unable to be retrieved from secure storage after save.");
      }
    }
    return key;
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
