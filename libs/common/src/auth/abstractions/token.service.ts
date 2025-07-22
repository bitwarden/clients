import { Observable } from "rxjs";

import { VaultTimeout, VaultTimeoutAction } from "../../key-management/vault-timeout";
import { UserId } from "../../types/guid";
import { SetTokensResult } from "../models/domain/set-tokens-result";
import { DecodedAccessToken } from "../services/token.service";

export abstract class TokenService {
  /**
   * Returns an observable that emits a boolean indicating whether the user has an access token.
   * @param userId The user id to check for an access token.
   */
  abstract hasAccessToken$(userId: UserId): Observable<boolean>;
  /**
   * Sets the access token, refresh token, API Key Client ID, and API Key Client Secret in memory or disk
   * based on the given vaultTimeoutAction and vaultTimeout and the derived access token user id.
   * Note: for platforms that support secure storage, the access & refresh tokens are stored in secure storage instead of on disk.
   * Note 2: this method also enforces always setting the access token and the refresh token together as
   * we can retrieve the user id required to set the refresh token from the access token for efficiency.
   * @param accessToken The access token to set.
   * @param vaultTimeoutAction The action to take when the vault times out.
   * @param vaultTimeout The timeout for the vault.
   * @param refreshToken The optional refresh token to set. Note: this is undefined when using the CLI Login Via API Key flow
   * @param clientIdClientSecret The API Key Client ID and Client Secret to set.
   *
   * @returns A promise that resolves with the SetTokensResult containing the tokens that were set.
   */
  abstract setTokens(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    refreshToken?: string,
    clientIdClientSecret?: [string, string],
  ): Promise<SetTokensResult>;

  /**
   * Clears the access token, refresh token, API Key Client ID, and API Key Client Secret out of memory, disk, and secure storage if supported.
   * @param userId The optional user id to clear the tokens for; if not provided, the active user id is used.
   * @returns A promise that resolves when the tokens have been cleared.
   */
  abstract clearTokens(userId?: UserId): Promise<void>;

  /**
   * Sets the access token in memory or disk based on the given vaultTimeoutAction and vaultTimeout
   * and the user id read off the access token
   * Note: for platforms that support secure storage, the access & refresh tokens are stored in secure storage instead of on disk.
   * @param accessToken The access token to set.
   * @param vaultTimeoutAction The action to take when the vault times out.
   * @param vaultTimeout The timeout for the vault.
   * @returns A promise that resolves with the access token that has been set.
   */
  abstract setAccessToken(
    accessToken: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
  ): Promise<string>;

  // TODO: revisit having this public clear method approach once the state service is fully deprecated.
  /**
   * Clears the access token for the given user id out of memory, disk, and secure storage if supported.
   * @param userId The optional user id to clear the access token for; if not provided, the active user id is used.
   * @returns A promise that resolves when the access token has been cleared.
   *
   * Note: This method is required so that the StateService doesn't have to inject the VaultTimeoutSettingsService to
   * pass in the vaultTimeoutAction and vaultTimeout.
   * This avoids a circular dependency between the StateService, TokenService, and VaultTimeoutSettingsService.
   */
  abstract clearAccessToken(userId?: UserId): Promise<void>;

  /**
   * Gets the access token
   * @param userId - The optional user id to get the access token for; if not provided, the active user is used.
   * @returns A promise that resolves with the access token or null.
   */
  abstract getAccessToken(userId?: UserId): Promise<string | null>;

  /**
   * Gets the refresh token.
   * @param userId - The optional user id to get the refresh token for; if not provided, the active user is used.
   * @returns A promise that resolves with the refresh token or null.
   */
  abstract getRefreshToken(userId?: UserId): Promise<string | null>;

  /**
   * Sets the API Key Client ID for the active user id in memory or disk based on the given vaultTimeoutAction and vaultTimeout.
   * @param clientId The API Key Client ID to set.
   * @param vaultTimeoutAction The action to take when the vault times out.
   * @param vaultTimeout The timeout for the vault.
   * @returns A promise that resolves with the API Key Client ID that has been set.
   */
  abstract setClientId(
    clientId: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId?: UserId,
  ): Promise<string>;

  /**
   * Gets the API Key Client ID for the active user.
   * @returns A promise that resolves with the API Key Client ID or undefined
   */
  abstract getClientId(userId?: UserId): Promise<string | undefined>;

  /**
   * Sets the API Key Client Secret for the active user id in memory or disk based on the given vaultTimeoutAction and vaultTimeout.
   * @param clientSecret The API Key Client Secret to set.
   * @param vaultTimeoutAction The action to take when the vault times out.
   * @param vaultTimeout The timeout for the vault.
   * @returns A promise that resolves with the client secret that has been set.
   */
  abstract setClientSecret(
    clientSecret: string,
    vaultTimeoutAction: VaultTimeoutAction,
    vaultTimeout: VaultTimeout,
    userId?: UserId,
  ): Promise<string>;

  /**
   * Gets the API Key Client Secret for the active user.
   * @returns A promise that resolves with the API Key Client Secret or undefined
   */
  abstract getClientSecret(userId?: UserId): Promise<string | undefined>;

  /**
   * Sets the two factor token for the given email in global state.
   * The two factor token is set when the user checks "remember me" when completing two factor
   * authentication and it is used to bypass two factor authentication for a period of time.
   * @param email The email to set the two factor token for.
   * @param twoFactorToken The two factor token to set.
   * @returns A promise that resolves when the two factor token has been set.
   */
  abstract setTwoFactorToken(email: string, twoFactorToken: string): Promise<void>;

  /**
   * Gets the two factor token for the given email.
   * @param email The email to get the two factor token for.
   * @returns A promise that resolves with the two factor token for the given email or null if it isn't found.
   */
  abstract getTwoFactorToken(email: string): Promise<string | null>;

  /**
   * Clears the two factor token for the given email out of global state.
   * @param email The email to clear the two factor token for.
   * @returns A promise that resolves when the two factor token has been cleared.
   */
  abstract clearTwoFactorToken(email: string): Promise<void>;

  /**
   * Decodes the access token.
   * @param tokenOrUserId The access token to decode or the user id to retrieve the access token for, and then decode.
   * If null, the currently active user's token is used.
   * @returns A promise that resolves with the decoded access token.
   */
  abstract decodeAccessToken(tokenOrUserId?: string | UserId): Promise<DecodedAccessToken>;

  /**
   * Gets the expiration date for the access token. Returns if token can't be decoded or has no expiration
   * @returns A promise that resolves with the expiration date for the access token.
   */
  abstract getTokenExpirationDate(): Promise<Date | null>;

  /**
   * Calculates the adjusted time in seconds until the access token expires, considering an optional offset.
   *
   * @param {number} [offsetSeconds=0] Optional seconds to subtract from the remaining time,
   * creating a buffer before actual expiration. Useful for preemptive actions
   * before token expiry. A value of 0 or omitting this parameter calculates time
   * based on the actual expiration.
   * @returns {Promise<number>} Promise resolving to the adjusted seconds remaining.
   */
  abstract tokenSecondsRemaining(offsetSeconds?: number): Promise<number>;

  /**
   * Checks if the access token needs to be refreshed.
   * @param {number} [minutes=5] - Optional number of minutes before the access token expires to consider refreshing it.
   * @returns A promise that resolves with a boolean indicating if the access token needs to be refreshed.
   */
  abstract tokenNeedsRefresh(minutes?: number): Promise<boolean>;

  /**
   * Gets the user id for the active user from the access token.
   * @returns A promise that resolves with the user id for the active user.
   * @deprecated Use AccountService.activeAccount$ instead.
   */
  abstract getUserId(): Promise<UserId>;

  /**
   * Gets the email for the active user from the access token.
   * @returns A promise that resolves with the email for the active user.
   * @deprecated Use AccountService.activeAccount$ instead.
   */
  abstract getEmail(): Promise<string>;

  /**
   * Gets the email verified status for the active user from the access token.
   * @returns A promise that resolves with the email verified status for the active user.
   */
  abstract getEmailVerified(): Promise<boolean>;

  /**
   * Gets the name for the active user from the access token.
   * @returns A promise that resolves with the name for the active user.
   * @deprecated Use AccountService.activeAccount$ instead.
   */
  abstract getName(): Promise<string>;

  /**
   * Gets the issuer for the active user from the access token.
   * @returns A promise that resolves with the issuer for the active user.
   */
  abstract getIssuer(): Promise<string>;

  /**
   * Gets whether or not the user authenticated via an external mechanism.
   * @param userId The optional user id to check for external authN status; if not provided, the active user is used.
   * @returns A promise that resolves with a boolean representing the user's external authN status.
   */
  abstract getIsExternal(userId: UserId): Promise<boolean>;

  /** Gets the active or passed in user's security stamp */
  abstract getSecurityStamp(userId?: UserId): Promise<string | null>;

  /** Sets the security stamp for the active or passed in user */
  abstract setSecurityStamp(securityStamp: string, userId?: UserId): Promise<void>;
}
