import { firstValueFrom } from "rxjs";
import { Opaque } from "type-fest";

import { decodeJwtTokenToJson } from "@bitwarden/auth/common";

import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { KeyGenerationService } from "../../platform/abstractions/key-generation.service";
import { LogService } from "../../platform/abstractions/log.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { EncString, EncryptedString } from "../../platform/models/domain/enc-string";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SingleUserStateProvider,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { TokenService as TokenServiceAbstraction } from "../abstractions/token.service";

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
  REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
} from "./token.state";

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
type AccessTokenKey = Opaque<SymmetricCryptoKey, "AccessTokenKey">;

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
  ) {
    this.initializeState();
  }

  // pivoting to an approach where we create a symmetric key we store in secure storage
  // which is used to protect the data before persisting to disk.
  // We will also use the same symmetric key to decrypt the data when reading from disk.

  private initializeState(): void {
    this.emailTwoFactorTokenRecordGlobalState = this.globalStateProvider.get(
      EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
    );

    this.activeUserIdGlobalState = this.globalStateProvider.get(ACCOUNT_ACTIVE_ACCOUNT_ID);
  }

  async setTokens(
    accessToken: string,
    refreshToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: number | null,
    clientIdClientSecret?: [string, string],
  ): Promise<void> {
    if (!accessToken || !refreshToken) {
      throw new Error("Access token and refresh token are required.");
    }

    // get user id the access token
    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    if (!userId) {
      throw new Error("User id not found. Cannot set tokens.");
    }

    await this._setAccessToken(accessToken, vaultTimeoutAction, vaultTimeout, userId);
    await this.setRefreshToken(refreshToken, vaultTimeoutAction, vaultTimeout, userId);
    if (clientIdClientSecret != null) {
      await this.setClientId(clientIdClientSecret[0], vaultTimeoutAction, vaultTimeout, userId);
      await this.setClientSecret(clientIdClientSecret[1], vaultTimeoutAction, vaultTimeout, userId);
    }
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
    let accessTokenKey: AccessTokenKey = await this.getAccessTokenKey(userId);

    if (!accessTokenKey) {
      // Otherwise, create a new one and save it to secure storage, then return it
      accessTokenKey = await this.createAndSaveAccessTokenKey(userId);
    }

    return accessTokenKey;
  }

  private async encryptAccessToken(accessToken: string, userId: UserId): Promise<EncString> {
    const accessTokenKey = await this.getOrCreateAccessTokenKey(userId);

    return await this.encryptService.encrypt(accessToken, accessTokenKey);
  }

  private async decryptAccessToken(
    encryptedAccessToken: EncString,
    userId: UserId,
  ): Promise<string | null> {
    const accessTokenKey = await this.getAccessTokenKey(userId);

    if (!accessTokenKey) {
      // If we don't have an accessTokenKey, then that means we don't have an access token as it hasn't been set yet
      // and we have to return null here to properly indicate the the user isn't logged in.
      return null;
    }

    const decryptedAccessToken = await this.encryptService.decryptToUtf8(
      encryptedAccessToken,
      accessTokenKey,
    );

    return decryptedAccessToken;
  }

  /**
   * Internal helper for set access token which always requires user id.
   * This is useful because setTokens always will have a user id from the access token whereas
   * the public setAccessToken method does not.
   */
  private async _setAccessToken(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: number | null,
    userId: UserId,
  ): Promise<void> {
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

        const encryptedAccessToken: EncString = await this.encryptAccessToken(accessToken, userId);

        // Save the encrypted access token to disk
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_DISK)
          .update((_) => encryptedAccessToken.encryptedString);

        // TODO: PM-6408 - https://bitwarden.atlassian.net/browse/PM-6408
        // 2024-02-20: Remove access token from memory so that we migrate to encrypt the access token over time.
        // Remove this call to remove the access token from memory after 3 releases.
        await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).update((_) => null);

        return;
      }
      case TokenStorageLocation.Disk:
        // Access token stored on disk unencrypted as platform does not support secure storage
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_DISK)
          .update((_) => accessToken);
        return;
      case TokenStorageLocation.Memory:
        // Access token stored in memory due to vault timeout settings
        await this.singleUserStateProvider
          .get(userId, ACCESS_TOKEN_MEMORY)
          .update((_) => accessToken);
        return;
    }
  }

  async setAccessToken(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: number | null,
  ): Promise<void> {
    if (!accessToken) {
      throw new Error("Access token is required.");
    }
    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save access token.");
    }

    await this._setAccessToken(accessToken, vaultTimeoutAction, vaultTimeout, userId);
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
    await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).update((_) => null);
    await this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).update((_) => null);
  }

  async getAccessToken(userId?: UserId): Promise<string | undefined> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      return undefined;
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
      const accessTokenKey = await this.getAccessTokenKey(userId);

      if (!accessTokenKey) {
        // We know this is an unencrypted access token because we don't have an access token key
        return accessTokenDisk;
      }

      try {
        const encryptedAccessTokenEncString = new EncString(accessTokenDisk as EncryptedString);

        const decryptedAccessToken = await this.decryptAccessToken(
          encryptedAccessTokenEncString,
          userId,
        );
        return decryptedAccessToken;
      } catch (error) {
        // If an error occurs during decryption, return null for logout.
        // We don't try to recover here since we'd like to know
        // if access token and key are getting out of sync.
        this.logService.error(
          `Failed to decrypt access token: ${error?.message ?? "Unknown error."}`,
        );
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
    vaultTimeout: number | null,
    userId: UserId,
  ): Promise<void> {
    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save refresh token.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      true,
    );

    switch (storageLocation) {
      case TokenStorageLocation.SecureStorage:
        await this.saveStringToSecureStorage(
          userId,
          this.refreshTokenSecureStorageKey,
          refreshToken,
        );

        // TODO: PM-6408 - https://bitwarden.atlassian.net/browse/PM-6408
        // 2024-02-20: Remove refresh token from memory and disk so that we migrate to secure storage over time.
        // Remove these 2 calls to remove the refresh token from memory and disk after 3 releases.
        await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null);
        await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_MEMORY).update((_) => null);

        // Set flag to indicate that the refresh token has been migrated to secure storage (don't remove this)
        await this.setRefreshTokenMigratedToSecureStorage(userId);

        return;

      case TokenStorageLocation.Disk:
        await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_DISK)
          .update((_) => refreshToken);
        return;

      case TokenStorageLocation.Memory:
        await this.singleUserStateProvider
          .get(userId, REFRESH_TOKEN_MEMORY)
          .update((_) => refreshToken);
        return;
    }
  }

  async getRefreshToken(userId?: UserId): Promise<string | undefined> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      return undefined;
    }

    const refreshTokenMigratedToSecureStorage =
      await this.getRefreshTokenMigratedToSecureStorage(userId);
    if (this.platformSupportsSecureStorage && refreshTokenMigratedToSecureStorage) {
      return await this.getStringFromSecureStorage(userId, this.refreshTokenSecureStorageKey);
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

    // if memory is null, read from disk
    const refreshTokenDisk = await this.getStateValueByUserIdAndKeyDef(userId, REFRESH_TOKEN_DISK);

    if (refreshTokenDisk != null) {
      return refreshTokenDisk;
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
    await this.singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => null);
  }

  private async getRefreshTokenMigratedToSecureStorage(userId: UserId): Promise<boolean> {
    return await firstValueFrom(
      this.singleUserStateProvider.get(userId, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE).state$,
    );
  }

  private async setRefreshTokenMigratedToSecureStorage(userId: UserId): Promise<void> {
    await this.singleUserStateProvider
      .get(userId, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE)
      .update((_) => true);
  }

  async setClientId(
    clientId: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: number | null,
    userId?: UserId,
  ): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    // If we don't have a user id, we can't save the value
    if (!userId) {
      throw new Error("User id not found. Cannot save client id.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      false, // don't use secure storage for client id
    );

    if (storageLocation === TokenStorageLocation.Disk) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_DISK)
        .update((_) => clientId);
    } else if (storageLocation === TokenStorageLocation.Memory) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_MEMORY)
        .update((_) => clientId);
    }
  }

  async getClientId(userId?: UserId): Promise<string | undefined> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

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
    vaultTimeout: number | null,
    userId?: UserId,
  ): Promise<void> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot save client secret.");
    }

    const storageLocation = await this.determineStorageLocation(
      vaultTimeoutAction,
      vaultTimeout,
      false, // don't use secure storage for client secret
    );

    if (storageLocation === TokenStorageLocation.Disk) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_DISK)
        .update((_) => clientSecret);
    } else if (storageLocation === TokenStorageLocation.Memory) {
      await this.singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_MEMORY)
        .update((_) => clientSecret);
    }
  }

  async getClientSecret(userId?: UserId): Promise<string | undefined> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

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

  async decodeAccessToken(token?: string): Promise<DecodedAccessToken> {
    token = token ?? (await this.getAccessToken());

    if (token == null) {
      throw new Error("Access token not found.");
    }

    return decodeJwtTokenToJson(token) as DecodedAccessToken;
  }

  // TODO: PM-6678- tech debt - consider consolidating the return types of all these access
  // token data retrieval methods to return null if something goes wrong instead of throwing an error.

  async getTokenExpirationDate(): Promise<Date | null> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
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

  async tokenSecondsRemaining(offsetSeconds = 0): Promise<number> {
    const date = await this.getTokenExpirationDate();
    if (date == null) {
      return 0;
    }

    const msRemaining = date.valueOf() - (new Date().valueOf() + offsetSeconds * 1000);
    return Math.round(msRemaining / 1000);
  }

  async tokenNeedsRefresh(minutes = 5): Promise<boolean> {
    const sRemaining = await this.tokenSecondsRemaining();
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

  async getIsExternal(): Promise<boolean> {
    let decoded: DecodedAccessToken;
    try {
      decoded = await this.decodeAccessToken();
    } catch (error) {
      throw new Error("Failed to decode access token: " + error.message);
    }

    return Array.isArray(decoded.amr) && decoded.amr.includes("external");
  }

  private async getStateValueByUserIdAndKeyDef(
    userId: UserId,
    storageLocation: KeyDefinition<string>,
  ): Promise<string | undefined> {
    // read from single user state provider
    return await firstValueFrom(this.singleUserStateProvider.get(userId, storageLocation).state$);
  }

  private async determineStorageLocation(
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: number | null,
    useSecureStorage: boolean,
  ): Promise<TokenStorageLocation> {
    if (vaultTimeoutAction === VaultTimeoutAction.LogOut && vaultTimeout != null) {
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
