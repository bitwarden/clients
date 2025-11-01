// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, combineLatest, firstValueFrom, map } from "rxjs";
import { Opaque } from "type-fest";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason, decodeJwtTokenToJson } from "@bitwarden/auth/common";

import { KeyGenerationService } from "../../key-management/crypto";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../key-management/crypto/models/enc-string";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutStringType,
} from "../../key-management/vault-timeout";
import { LogService } from "../../platform/abstractions/log.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { Utils } from "../../platform/misc/utils";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  GlobalState,
  GlobalStateProvider,
  SingleUserStateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { TokenService as TokenServiceAbstraction } from "../abstractions/token.service";
import { SetTokensResult } from "../models/domain/set-tokens-result";

import { ACCOUNT_ACTIVE_ACCOUNT_ID } from "./account.service";
import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  SECURITY_STAMP_MEMORY,
} from "./token.state";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum TokenStorageLocation {
  Disk = "disk",
  SecureStorage = "secureStorage",
  Memory = "memory",
}

/**
 * Type representing the structure of a standard Bitwarden decoded access token.
 * src: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 * Note: all claims are technically optional so we must verify their existence before using them.
 * Note 2: NumericDate is a number representing a date in seconds since the Unix epoch.
 */
export type DecodedAccessToken = {
  /** Issuer  - the issuer of the token, typically the URL of the authentication server */
  iss?: string;

  /** Not Before - a timestamp defining when the token starts being valid */
  nbf?: number;

  /** Issued At - a timestamp of when the token was issued */
  iat?: number;

  /** Expiration Time - a NumericDate timestamp of when the token will expire */
  exp?: number;

  /** Scope - the scope of the access request, such as the permissions the token grants */
  scope?: string[];

  /** Authentication Method Reference - the methods used in the authentication */
  amr?: string[];

  /** Client ID - the identifier for the client that requested the token */
  client_id?: string;

  /** Subject - the unique identifier for the user */
  sub?: string;

  /** Authentication Time - a timestamp of when the user authentication occurred */
  auth_time?: number;

  /** Identity Provider - the system or service that authenticated the user */
  idp?: string;

  /** Premium - a boolean flag indicating whether the account is premium */
  premium?: boolean;

  /** Email - the user's email address */
  email?: string;

  /** Email Verified - a boolean flag indicating whether the user's email address has been verified */
  email_verified?: boolean;

  /**
   * Security Stamp - a unique identifier which invalidates the access token if it changes in the db
   * (typically after critical account changes like a password change)
   */
  sstamp?: string;

  /** Name - the name of the user */
  name?: string;

  /** Organization Owners - a list of organization owner identifiers */
  orgowner?: string[];

  /** Device - the identifier of the device used */
  device?: string;

  /** JWT ID - a unique identifier for the JWT */
  jti?: string;
};

/**
 * A symmetric key for encrypting the access token before the token is stored on disk.
 * This key should be stored in secure storage.
 * */
export type AccessTokenKey = Opaque<SymmetricCryptoKey, "AccessTokenKey">;

export class TokenService implements TokenServiceAbstraction {
  private readonly accessTokenKeySecureStorageKey: string = "_accessTokenKey";

  private readonly refreshTokenSecureStorageKey: string = "_refreshToken";

  private emailTwoFactorTokenRecordGlobalState: GlobalState<Record<string, string>>;

  private activeUserIdGlobalState: GlobalState<UserId>;

  constructor(
    // Note: we cannot use ActiveStateProvider because if we ever want to inject
    // this service into the AccountService, we will make a circular dependency
    private singleUserStateProvider: SingleUserStateProvider,
    private globalStateProvider: GlobalStateProvider,
    private readonly platformSupportsSecureStorage: boolean,
    private secureStorageService: AbstractStorageService,
    private keyGenerationService: KeyGenerationService,
    private encryptService: EncryptService,
    private logService: LogService,
    private logoutCallback: (logoutReason: LogoutReason, userId?: string) => Promise<void>,
  ) {
    this.initializeState();
  }

  hasAccessToken$(userId: UserId): Observable<boolean> {
    // FIXME Once once vault timeout action is observable, we can use it to determine storage location
    // and avoid the need to check both disk and memory.
    return combineLatest([
      this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$,
      this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).state$,
    ]).pipe(map(([disk, memory]) => Boolean(disk || memory)));
  }

  private initializeState(): void {
    this.emailTwoFactorTokenRecordGlobalState = this.globalStateProvider.get(
      EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
    );

    this.activeUserIdGlobalState = this.globalStateProvider.get(ACCOUNT_ACTIVE_ACCOUNT_ID);
  }

  async setTokens(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    refreshToken?: string,
    clientIdClientSecret?: [string, string],
  ): Promise<SetTokensResult> {
    if (!accessToken) {
      throw new Error("Access token is required.");
    }

    // Can't check for falsey b/c 0 is a valid value
    if (vaultTimeout == null) {
      throw new Error("Vault Timeout is required.");
    }

    if (vaultTimeoutAction == null) {
      throw new Error("Vault Timeout Action is required.");
    }

    // get user id the access token
    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    if (!userId) {
      throw new Error("User id not found. Cannot set tokens.");
    }

    const newAccessToken = await this._setAccessToken(
      accessToken,
      vaultTimeoutAction,
      vaultTimeout,
      userId,
    );

    const newTokens = new SetTokensResult(newAccessToken);

    if (refreshToken) {
      newTokens.refreshToken = await this.setRefreshToken(
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
        userId,
      );
    }

    if (clientIdClientSecret != null) {
      const clientId = await this.setClientId(
        clientIdClientSecret[0],
        vaultTimeoutAction,
        vaultTimeout,
        userId,
      );
      const clientSecret = await this.setClientSecret(
        clientIdClientSecret[1],
        vaultTimeoutAction,
        vaultTimeout,
        userId,
      );
      newTokens.clientIdSecretPair = [clientId, clientSecret];
    }
    return newTokens;
  }

  private async getAccessTokenKey(userId: UserId): Promise<AccessTokenKey | null> {
    const accessTokenKeyB64 = await this.secureStorageService.get<
      ReturnType<SymmetricCryptoKey["toJSON"]>
    >(`${userId}${this.accessTokenKeySecureStorageKey}`, this.getSecureStorageOptions(userId));

    if (!accessTokenKeyB64) {
      return null;
    }

    const accessTokenKey = SymmetricCryptoKey.fromJSON(accessTokenKeyB64) as AccessTokenKey;
    return accessTokenKey;
  }

  private async createAndSaveAccessTokenKey(userId: UserId): Promise<AccessTokenKey> {
    const newAccessTokenKey = (await this.keyGenerationService.createKey(512)) as AccessTokenKey;

    await this.secureStorageService.save<AccessTokenKey>(
      `${userId}${this.accessTokenKeySecureStorageKey}`,
      newAccessTokenKey,
      this.getSecureStorageOptions(userId),
    );

    // We are having intermittent issues with access token keys not saving into secure storage on windows 10/11.
    // So, let's add a check to ensure we can read the value after writing it.
    const accessTokenKey = await this.getAccessTokenKey(userId);

    if (!accessTokenKey) {
      throw new Error("New Access token key unable to be retrieved from secure storage.");
    }

    return newAccessTokenKey;
  }

  private async clearAccessTokenKey(userId: UserId): Promise<void> {
    await this.secureStorageService.remove(
      `${userId}${this.accessTokenKeySecureStorageKey}`,
      this.getSecureStorageOptions(userId),
    );
  }

  private async getOrCreateAccessTokenKey(userId: UserId): Promise<AccessTokenKey> {
    if (!this.platformSupportsSecureStorage) {
      throw new Error("Platform does not support secure storage. Cannot obtain access token key.");
    }

    if (!userId) {
      throw new Error("User id not found. Cannot obtain access token key.");
    }

    // First see if we have an accessTokenKey in secure storage and return it if we do
    // Note: retrieving/saving data from/to secure storage on linux will throw if the
    // distro doesn't have a secure storage provider
    let accessTokenKey: AccessTokenKey = await this.getAccessTokenKey(userId);

    if (!accessTokenKey) {
      // Otherwise, create a new one and save it to secure storage, then return it
      accessTokenKey = await this.createAndSaveAccessTokenKey(userId);
    }

    return accessTokenKey;
  }

  private async encryptAccessToken(accessToken: string, userId: UserId): Promise<EncString> {
    const accessTokenKey = await this.getOrCreateAccessTokenKey(userId);

    return await this.encryptService.encryptString(accessToken, accessTokenKey);
  }

  /**
   * Decrypts the access token using the provided access token key.
   *
   * @param accessTokenKey - the key used to decrypt the access token
   * @param encryptedAccessToken - the encrypted access token to decrypt
   * @returns the decrypted access token
   * @throws Error if the access token key is not provided or the decryption fails
   */
  private async decryptAccessToken(
    accessTokenKey: AccessTokenKey,
    encryptedAccessToken: EncString,
  ): Promise<string> {
    if (!accessTokenKey) {
      throw new Error(
        "decryptAccessToken: Access token key required. Cannot decrypt access token.",
      );
    }

    try {
      const decryptedAccessToken = await this.encryptService.decryptString(
        encryptedAccessToken,
        accessTokenKey,
      );
      return decryptedAccessToken;
    } catch (e) {
      // Note: This should be replaced by the owning team with appropriate, domain-specific behavior.

      this.logService.error("[TokenService] Error decrypting access token", e);
      throw e;
    }
  }

  /**
   * Internal helper for set access token which always requires user id.
   * This is useful because setTokens always will have a user id from the access token whereas
   * the public setAccessToken method does not.
   */
  private async _setAccessToken(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId: UserId,
  ): Promise<string> {
    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      true,
    );

    switch (storageLocation) {
      case TokenStorageLocation.SecureStorage: {
        // Secure storage implementations have variable length limitations (Windows), so we cannot
        // store the access token directly. Instead, we encrypt with accessTokenKey and store that
        // in secure storage.

        let decryptedAccessToken: string = null;

        try {
          const encryptedAccessToken: EncString = await this.encryptAccessToken(
            accessToken,
            userId,
          );

          // Save the encrypted access token to disk
          await this.singleUserStateProvider
            .get(userId, ACCESS_TOKEN_DISK)
            .update((_) => encryptedAccessToken.encryptedString, {
              shouldUpdate: (previousValue) =>
                previousValue !== encryptedAccessToken.encryptedString,
            });

          // If we've successfully stored the encrypted access token to disk, we can return the decrypted access token
          // so that the caller can use it immediately.
          decryptedAccessToken = accessToken;

          // TODO: PM-6408
          // 2024-02-20: Remove access token from memory so that we migrate to encrypt the access token over time.
          // Remove this call to remove the access token from memory after 3 months.
          await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).update((_) => null);
        } catch (error) {
          this.logService.error(
            `SetAccessToken: storing encrypted access token in secure storage failed. Falling back to disk storage.`,
            error,
          );

          // Fall back to disk storage for unecrypted access token
          decryptedAccessToken = await this.singleUserStateProvider
            .get(userId, ACCESS_TOKEN_DISK)
            .update((_) => accessToken, {
              shouldUpdate: (previousValue) => previousValue !== accessToken,
            });
        }

        return decryptedAccessToken;
      }
      case TokenStorageLocation.Disk:
        // Access token stored on disk unencrypted as platform does not support secure storage
        return await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_DISK)
          .update((_) => accessToken, {
            shouldUpdate: (previousValue) => previousValue !== accessToken,
          });
      case TokenStorageLocation.Memory:
        // Access token stored in memory due to vault timeout settings
        return await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_MEMORY)
          .update((_) => accessToken);
    }
  }

  async setAccessToken(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
  ): Promise<string> {
    if (!accessToken) {
      throw new Error("Access token is required.");
    }
    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save access token.");
    }

    // Can't check for falsey b/c 0 is a valid value
    if (vaultTimeout == null) {
      throw new Error("Vault Timeout is required.");
    }

    if (vaultTimeoutAction == null) {
      throw new Error("Vault Timeout Action is required.");
    }

    return await this._setAccessToken(accessToken, vaultTimeoutAction, vaultTimeout, userId);
  }

  async clearAccessToken(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    // If we don't have a user id, we can't clear the value
    if (!userId) {
      throw new Error("User id not found. Cannot clear access token.");
    }

    // TODO: re-eval this implementation once we get shared key definitions for vault timeout and vault timeout action data.
    // we can't determine storage location w/out vaultTimeoutAction and vaultTimeout
    // but we can simply clear all locations to avoid the need to require those parameters.

    if (this.platformSupportsSecureStorage) {
      // Always clear the access token key when clearing the access token
      // The next set of the access token will create a new access token key
      await this.clearAccessTokenKey(userId);
    }

    // Platform doesn't support secure storage, so use state provider implementation
    await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).update((_) => null, {
      shouldUpdate: (previousValue) => previousValue !== null,
    });
    await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).update((_) => null);
  }

  async getAccessToken(userId: UserId): Promise<string | null> {
    if (!userId) {
      return null;
    }

    // Try to get the access token from memory
    const accessTokenMemory = await this.getStateValueByUserIdAndKeyDef(
      userId,
      ACCESS_TOKEN_MEMORY,
    );
    if (accessTokenMemory != null) {
      return accessTokenMemory;
    }

    // If memory is null, read from disk
    const accessTokenDisk = await this.getStateValueByUserIdAndKeyDef(userId, ACCESS_TOKEN_DISK);
    if (!accessTokenDisk) {
      return null;
    }

    if (this.platformSupportsSecureStorage) {
      let accessTokenKey: AccessTokenKey;
      try {
        accessTokenKey = await this.getAccessTokenKey(userId);
      } catch (error) {
        if (EncString.isSerializedEncString(accessTokenDisk)) {
          this.logService.error(
            "Access token key retrieval failed. Unable to decrypt encrypted access token. Logging user out.",
            error,
          );
          await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);
          return null;
        }

        // If the access token key is not found, but the access token is unencrypted then
        // this indicates that this is the pre-migration state where the access token
        // was stored unencrypted on disk. We can return the access token as is.
        // Note: this is likely to only be hit for linux users who don't
        // have a secure storage provider configured.
        return accessTokenDisk;
      }

      if (!accessTokenKey) {
        if (EncString.isSerializedEncString(accessTokenDisk)) {
          // The access token is encrypted but we don't have the key to decrypt it for
          // whatever reason so we have to log the user out.
          this.logService.error(
            "Access token key not found to decrypt encrypted access token. Logging user out.",
          );

          await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);

          return null;
        }

        // We know this is an unencrypted access token
        return accessTokenDisk;
      }

      try {
        const encryptedAccessTokenEncString = new EncString(accessTokenDisk as EncryptedString);

        const decryptedAccessToken = await this.decryptAccessToken(
          accessTokenKey,
          encryptedAccessTokenEncString,
        );
        return decryptedAccessToken;
      } catch (error) {
        // If an error occurs during decryption, logout and then return null.
        // We don't try to recover here since we'd like to know
        // if access token and key are getting out of sync.
        this.logService.error(`Failed to decrypt access token`, error);

        await this.logoutCallback("accessTokenUnableToBeDecrypted", userId);

        return null;
      }
    }
    return accessTokenDisk;
  }

  // Private because we only ever set the refresh token when also setting the access token
  // and we need the user id from the access token to save to secure storage
  private async setRefreshToken(
    refreshToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId: UserId,
  ): Promise<string> {
    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save refresh token.");
    }

    // Can't check for falsey b/c 0 is a valid value
    if (vaultTimeout == null) {
      throw new Error("Vault Timeout is required.");
    }

    if (vaultTimeoutAction == null) {
      throw new Error("Vault Timeout Action is required.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      true,
    );

    switch (storageLocation) {
      case TokenStorageLocation.SecureStorage: {
        let decryptedRefreshToken: string = null;

        try {
          await this.saveStringToSecureStorage(
            userId,
            this.refreshTokenSecureStorageKey,
            refreshToken,
          );

          // Check if the refresh token was able to be saved to secure storage by reading it
          // immediately after setting it. This is needed due to intermittent silent failures on Windows 10/11.
          const refreshTokenSecureStorage = await this.getStringFromSecureStorage(
            userId,
            this.refreshTokenSecureStorageKey,
          );

          // Only throw if the refresh token was not saved to secure storage
          // If we only check for a nullish value out of secure storage without considering the input value,
          // then we would end up falling back to disk storage if the input value was null.
          if (refreshToken !== null && !refreshTokenSecureStorage) {
            throw new Error("Refresh token failed to save to secure storage.");
          }

          // If we've successfully stored the encrypted refresh token, we can return the decrypted refresh token
          // so that the caller can use it immediately.
          decryptedRefreshToken = refreshToken;

          // TODO: PM-6408
          // 2024-02-20: Remove refresh token from memory and disk so that we migrate to secure storage over time.
          // Remove these 2 calls to remove the refresh token from memory and disk after 3 months.
          await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null, {
            shouldUpdate: (previousValue) => previousValue !== null,
          });
          await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_MEMORY).update((_) => null);
        } catch (error) {
          // This case could be hit for both Linux users who don't have secure storage configured
          // or for Windows users who have intermittent issues with secure storage.
          this.logService.error(
            `SetRefreshToken: storing refresh token in secure storage failed. Falling back to disk storage.`,
            error,
          );

          // Fall back to disk storage for refresh token
          decryptedRefreshToken = await this.singleUserStateProvider
            .get(userId, REFRESH_TOKEN_DISK)
            .update((_) => refreshToken, {
              shouldUpdate: (previousValue) => previousValue !== refreshToken,
            });
        }

        return decryptedRefreshToken;
      }
      case TokenStorageLocation.Disk:
        return await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_DISK)
          .update((_) => refreshToken, {
            shouldUpdate: (previousValue) => previousValue !== refreshToken,
          });

      case TokenStorageLocation.Memory:
        return await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_MEMORY)
          .update((_) => refreshToken);
    }
  }

  async getRefreshToken(userId: UserId): Promise<string | null> {
    if (!userId) {
      return null;
    }

    // pre-secure storage migration:
    // Always read memory first b/c faster
    const refreshTokenMemory = await this.getStateValueByUserIdAndKeyDef(
      userId,
      REFRESH_TOKEN_MEMORY,
    );

    if (refreshTokenMemory != null) {
      return refreshTokenMemory;
    }

    // if memory is null, read from disk and then secure storage
    const refreshTokenDisk = await this.getStateValueByUserIdAndKeyDef(userId, REFRESH_TOKEN_DISK);

    if (refreshTokenDisk != null) {
      // This handles the scenario pre-secure storage migration where the refresh token was stored on disk.
      return refreshTokenDisk;
    }

    if (this.platformSupportsSecureStorage) {
      try {
        const refreshTokenSecureStorage = await this.getStringFromSecureStorage(
          userId,
          this.refreshTokenSecureStorageKey,
        );

        if (refreshTokenSecureStorage != null) {
          return refreshTokenSecureStorage;
        }

        this.logService.error(
          "Refresh token not found in secure storage. Access token will fail to refresh upon expiration or manual refresh.",
        );
      } catch (error) {
        // This case will be hit for Linux users who don't have secure storage configured.

        this.logService.error(`Failed to retrieve refresh token from secure storage`, error);

        await this.logoutCallback("refreshTokenSecureStorageRetrievalFailure", userId);
      }
    }

    return null;
  }

  private async clearRefreshToken(userId: UserId): Promise<void> {
    // If we don't have a user id, we can't clear the value
    if (!userId) {
      throw new Error("User id not found. Cannot clear refresh token.");
    }

    // TODO: re-eval this once we get shared key definitions for vault timeout and vault timeout action data.
    // we can't determine storage location w/out vaultTimeoutAction and vaultTimeout
    // but we can simply clear all locations to avoid the need to require those parameters

    if (this.platformSupportsSecureStorage) {
      await this.secureStorageService.remove(
        `${userId}${this.refreshTokenSecureStorageKey}`,
        this.getSecureStorageOptions(userId),
      );
    }

    // Platform doesn't support secure storage, so use state provider implementation
    await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_MEMORY).update((_) => null);
    await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null, {
      shouldUpdate: (previousValue) => previousValue !== null,
    });
  }

  async setClientId(
    clientId: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId?: UserId,
  ): Promise<string> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save client id.");
    }

    // Can't check for falsey b/c 0 is a valid value
    if (vaultTimeout == null) {
      throw new Error("Vault Timeout is required.");
    }

    if (vaultTimeoutAction == null) {
      throw new Error("Vault Timeout Action is required.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      false, // don't use secure storage for client id
    );

    if (storageLocation === TokenStorageLocation.Disk) {
      return await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_DISK)
        .update((_) => clientId);
    } else if (storageLocation === TokenStorageLocation.Memory) {
      return await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_MEMORY)
        .update((_) => clientId);
    }
  }

  async getClientId(userId: UserId): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    // Always read memory first b/c faster
    const apiKeyClientIdMemory = await this.getStateValueByUserIdAndKeyDef(
      userId,
      API_KEY_CLIENT_ID_MEMORY,
    );

    if (apiKeyClientIdMemory != null) {
      return apiKeyClientIdMemory;
    }

    // if memory is null, read from disk
    return await this.getStateValueByUserIdAndKeyDef(userId, API_KEY_CLIENT_ID_DISK);
  }

  private async clearClientId(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    // If we don't have a user id, we can't clear the value
    if (!userId) {
      throw new Error("User id not found. Cannot clear client id.");
    }

    // TODO: re-eval this once we get shared key definitions for vault timeout and vault timeout action data.
    // we can't determine storage location w/out vaultTimeoutAction and vaultTimeout
    // but we can simply clear both locations to avoid the need to require those parameters

    // Platform doesn't support secure storage, so use state provider implementation
    await this.singleUserStateProvider.get(userId, API_KEY_CLIENT_ID_MEMORY).update((_) => null);
    await this.singleUserStateProvider.get(userId, API_KEY_CLIENT_ID_DISK).update((_) => null);
  }

  async setClientSecret(
    clientSecret: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId?: UserId,
  ): Promise<string> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot save client secret.");
    }

    // Can't check for falsey b/c 0 is a valid value
    if (vaultTimeout == null) {
      throw new Error("Vault Timeout is required.");
    }

    if (vaultTimeoutAction == null) {
      throw new Error("Vault Timeout Action is required.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      false, // don't use secure storage for client secret
    );

    if (storageLocation === TokenStorageLocation.Disk) {
      return await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_DISK)
        .update((_) => clientSecret);
    } else if (storageLocation === TokenStorageLocation.Memory) {
      return await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_MEMORY)
        .update((_) => clientSecret);
    }
  }

  async getClientSecret(userId: UserId): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    // Always read memory first b/c faster
    const apiKeyClientSecretMemory = await this.getStateValueByUserIdAndKeyDef(
      userId,
      API_KEY_CLIENT_SECRET_MEMORY,
    );

    if (apiKeyClientSecretMemory != null) {
      return apiKeyClientSecretMemory;
    }

    // if memory is null, read from disk
    return await this.getStateValueByUserIdAndKeyDef(userId, API_KEY_CLIENT_SECRET_DISK);
  }

  private async clearClientSecret(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    // If we don't have a user id, we can't clear the value
    if (!userId) {
      throw new Error("User id not found. Cannot clear client secret.");
    }

    // TODO: re-eval this once we get shared key definitions for vault timeout and vault timeout action data.
    // we can't determine storage location w/out vaultTimeoutAction and vaultTimeout
    // but we can simply clear both locations to avoid the need to require those parameters

    // Platform doesn't support secure storage, so use state provider implementation
    await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_SECRET_MEMORY)
      .update((_) => null);
    await this.singleUserStateProvider.get(userId, API_KEY_CLIENT_SECRET_DISK).update((_) => null);
  }

  async setTwoFactorToken(email: string, twoFactorToken: string): Promise<void> {
    await this.emailTwoFactorTokenRecordGlobalState.update((emailTwoFactorTokenRecord) => {
      emailTwoFactorTokenRecord ??= {};

      emailTwoFactorTokenRecord[email] = twoFactorToken;
      return emailTwoFactorTokenRecord;
    });
  }

  async getTwoFactorToken(email: string): Promise<string | null> {
    const emailTwoFactorTokenRecord: Record<string, string> = await firstValueFrom(
      this.emailTwoFactorTokenRecordGlobalState.state$,
    );

    if (!emailTwoFactorTokenRecord) {
      return null;
    }

    return emailTwoFactorTokenRecord[email];
  }

  async clearTwoFactorToken(email: string): Promise<void> {
    await this.emailTwoFactorTokenRecordGlobalState.update((emailTwoFactorTokenRecord) => {
      emailTwoFactorTokenRecord ??= {};
      delete emailTwoFactorTokenRecord[email];
      return emailTwoFactorTokenRecord;
    });
  }

  // TODO: stop accepting optional userIds
  async clearTokens(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot clear tokens.");
    }

    await Promise.all([
      this.clearAccessToken(userId),
      this.clearRefreshToken(userId),
      this.clearClientId(userId),
      this.clearClientSecret(userId),
    ]);
  }

  // jwthelper methods
  // ref https://github.com/auth0/angular-jwt/blob/master/src/angularJwt/services/jwt.js

  async decodeAccessToken(tokenOrUserId?: string | UserId): Promise<DecodedAccessToken> {
    let token = tokenOrUserId as string;
    if (Utils.isGuid(tokenOrUserId)) {
      token = await this.getAccessToken(tokenOrUserId as UserId);
    } else {
      token ??= await this.getAccessToken(
        await firstValueFrom(this.activeUserIdGlobalState.state$),
      );
    }

    if (token == null) {
      throw new Error("Access token not found.");
    }

    return decodeJwtTokenToJson(token) as DecodedAccessToken;
  }

  // TODO: PM-6678- tech debt - consider consolidating the return types of all these access
  // token data retrieval methods to return null if something goes wrong instead of throwing an error.

  async getTokenExpirationDate(userId: UserId): Promise<Date | null> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken(userId);
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    // per RFC, exp claim is optional but if it exists, it should be a number
    if (!decoded || typeof decoded.exp !== "number") {
      return null;
    }

    // The 0 in Date(0) is the key; it sets the date to the epoch
    const expirationDate = new Date(0);
    expirationDate.setUTCSeconds(decoded.exp);
    return expirationDate;
  }

  async tokenSecondsRemaining(userId: UserId, offsetSeconds = 0): Promise<number> {
    const date = await this.getTokenExpirationDate(userId);
    if (date == null) {
      return 0;
    }

    const msRemaining = date.valueOf() - (new Date().valueOf() + offsetSeconds * 1000);
    return Math.round(msRemaining / 1000);
  }

  async tokenNeedsRefresh(userId: UserId, minutes = 5): Promise<boolean> {
    const sRemaining = await this.tokenSecondsRemaining(userId);
    return sRemaining < 60 * minutes;
  }

  async getUserId(): Promise<UserId> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("No user id found");
    }

    return decoded.sub as UserId;
  }

  private async getUserIdFromAccessToken(accessToken: string): Promise<UserId> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken(accessToken);
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("No user id found");
    }

    return decoded.sub as UserId;
  }

  async getEmail(): Promise<string> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.email !== "string") {
      throw new Error("No email found");
    }

    return decoded.email;
  }

  async getEmailVerified(): Promise<boolean> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.email_verified !== "boolean") {
      throw new Error("No email verification found");
    }

    return decoded.email_verified;
  }

  async getName(): Promise<string> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.name !== "string") {
      return null;
    }

    return decoded.name;
  }

  async getIssuer(): Promise<string> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    if (!decoded || typeof decoded.iss !== "string") {
      throw new Error("No issuer found");
    }

    return decoded.iss;
  }

  async getIsExternal(userId: UserId): Promise<boolean> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken(userId);
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    return Array.isArray(decoded.amr) && decoded.amr.includes("external");
  }

  async getSecurityStamp(userId?: UserId): Promise<string | null> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot get security stamp.");
    }

    const securityStamp = await this.getStateValueByUserIdAndKeyDef(userId, SECURITY_STAMP_MEMORY);

    return securityStamp;
  }

  async setSecurityStamp(securityStamp: string, userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot set security stamp.");
    }

    await this.singleUserStateProvider
      .get(userId, SECURITY_STAMP_MEMORY)
      .update((_) => securityStamp);
  }

  private async getStateValueByUserIdAndKeyDef(
    userId: UserId,
    storageLocation: UserKeyDefinition<string>,
  ): Promise<string | undefined> {
    // read from single user state provider
    return await firstValueFrom(this.singleUserStateProvider.get(userId, storageLocation).state$);
  }

  private async determineStorageLocation(
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    useSecureStorage: boolean,
  ): Promise<TokenStorageLocation> {
    if (vaultTimeoutAction == null) {
      throw new Error(
        "TokenService - determineStorageLocation: We expect the vault timeout action to always exist at this point.",
      );
    }

    if (vaultTimeout == null) {
      throw new Error(
        "TokenService - determineStorageLocation: We expect the vault timeout to always exist at this point.",
      );
    }

    if (
      vaultTimeoutAction === VaultTimeoutAction.LogOut &&
      vaultTimeout !== VaultTimeoutStringType.Never
    ) {
      return TokenStorageLocation.Memory;
    } else {
      if (useSecureStorage && this.platformSupportsSecureStorage) {
        return TokenStorageLocation.SecureStorage;
      }

      return TokenStorageLocation.Disk;
    }
  }

  private async saveStringToSecureStorage(
    userId: UserId,
    storageKey: string,
    value: string,
  ): Promise<void> {
    await this.secureStorageService.save<string>(
      `${userId}${storageKey}`,
      value,
      this.getSecureStorageOptions(userId),
    );
  }

  private async getStringFromSecureStorage(
    userId: UserId,
    storageKey: string,
  ): Promise<string | null> {
    // If we have a user ID, read from secure storage.
    return await this.secureStorageService.get<string>(
      `${userId}${storageKey}`,
      this.getSecureStorageOptions(userId),
    );
  }

  private getSecureStorageOptions(userId: UserId): StorageOptions {
    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId: userId,
    };
  }
}
