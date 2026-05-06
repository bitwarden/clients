import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { SetTokensResult } from "../models/domain/set-tokens-result";
import { DecodedAccessToken } from "../services/token.service";

/**
 * Manages the application's authentication tokens (access, refresh, API key client ID/secret)
 * and the per-email two-factor "remember me" token.
 *
 * **Memory-only contract.** All token reads and writes performed by this service operate on
 * memory state exclusively. Disk persistence (and OS secure storage) is owned entirely by
 * `TokenStorageSyncService`, which reacts to changes on the observables exposed here and
 * decides whether to write to or wipe the persistent tier based on the user's vault timeout
 * settings.
 *
 * **Logout cleanup.** The four token memory state keys use `clearOn: ["logout"]`, so they are
 * cleared automatically by `StateEventRunnerService.handleEvent("logout", userId)`
 * Logout sites are still required to call
 * `tokenStorageSyncService.clearTokensFromDisk(userId)` to wipe disk and OS secure storage
 * synchronously.
 *
 * The two-factor token methods (`setTwoFactorToken`, `getTwoFactorToken`, `clearTwoFactorToken`)
 * are an exception — they read/write a global disk-backed state key and are unrelated to the
 * memory-first authentication-token model.
 */
export abstract class TokenService {
  /**
   * Returns an observable that emits a boolean indicating whether the user has an access token.
   * @param userId The user id to check for an access token.
   */
  abstract hasAccessToken$(userId: UserId): Observable<boolean>;

  /** Observable stream of the plaintext access token in memory for the given user. */
  abstract accessToken$(userId: UserId): Observable<string | null>;

  /** Observable stream of the plaintext refresh token in memory for the given user. */
  abstract refreshToken$(userId: UserId): Observable<string | null>;

  /** Observable stream of the API key client ID in memory for the given user. */
  abstract clientId$(userId: UserId): Observable<string | null>;

  /** Observable stream of the API key client secret in memory for the given user. */
  abstract clientSecret$(userId: UserId): Observable<string | null>;

  /**
   * Sets the access token, refresh token, API Key Client ID, and API Key Client Secret in memory.
   * Disk persistence is handled reactively by TokenStorageSyncService.
   * Note: this method also enforces always setting the access token and the refresh token together as
   * we can retrieve the user id required to set the refresh token from the access token for efficiency.
   * @param accessToken The access token to set.
   * @param refreshToken The optional refresh token to set. Note: this is undefined when using the CLI Login Via API Key flow
   * @param clientIdClientSecret The API Key Client ID and Client Secret to set.
   *
   * @returns A promise that resolves with the SetTokensResult containing the tokens that were set.
   */
  abstract setTokens(
    accessToken: string,
    refreshToken?: string,
    clientIdClientSecret?: [string, string],
  ): Promise<SetTokensResult>;

  /**
   * Sets the access token in memory. Disk persistence is handled reactively by TokenStorageSyncService.
   * @param accessToken The access token to set.
   * @returns A promise that resolves with the access token that has been set.
   */
  abstract setAccessToken(accessToken: string): Promise<string>;

  /**
   * Gets the access token from memory for the given user.
   * @param userId The user id to get the access token for.
   * @returns A promise that resolves with the access token or null.
   */
  abstract getAccessToken(userId: UserId): Promise<string | null>;

  /**
   * Gets the refresh token from memory for the given user.
   * @param userId The user id to get the refresh token for.
   * @returns A promise that resolves with the refresh token or null.
   */
  abstract getRefreshToken(userId: UserId): Promise<string | null>;

  /**
   * Sets the API Key Client ID in memory. Disk persistence is handled reactively by TokenStorageSyncService.
   * @param clientId The API Key Client ID to set.
   * @returns A promise that resolves with the API Key Client ID that has been set.
   */
  abstract setClientId(clientId: string, userId?: UserId): Promise<string>;

  /**
   * Gets the API Key Client ID for the given user.
   * @returns A promise that resolves with the API Key Client ID or undefined
   */
  abstract getClientId(userId: UserId): Promise<string | undefined>;

  /**
   * Sets the API Key Client Secret in memory. Disk persistence is handled reactively by TokenStorageSyncService.
   * @param clientSecret The API Key Client Secret to set.
   * @returns A promise that resolves with the client secret that has been set.
   */
  abstract setClientSecret(clientSecret: string, userId?: UserId): Promise<string>;

  /**
   * Gets the API Key Client Secret for the given user.
   * @returns A promise that resolves with the API Key Client Secret or undefined
   */
  abstract getClientSecret(userId: UserId): Promise<string | undefined>;

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
  abstract getTokenExpirationDate(userId: UserId): Promise<Date | null>;

  /**
   * Calculates the adjusted time in seconds until the access token expires, considering an optional offset.
   *
   * @param {number} [offsetSeconds=0] Optional seconds to subtract from the remaining time,
   * creating a buffer before actual expiration. Useful for preemptive actions
   * before token expiry. A value of 0 or omitting this parameter calculates time
   * based on the actual expiration.
   * @returns {Promise<number>} Promise resolving to the adjusted seconds remaining.
   */
  abstract tokenSecondsRemaining(userId: UserId, offsetSeconds?: number): Promise<number>;

  /**
   * Checks if the access token needs to be refreshed.
   * @param {number} [minutes=5] - Optional number of minutes before the access token expires to consider refreshing it.
   * @returns A promise that resolves with a boolean indicating if the access token needs to be refreshed.
   */
  abstract tokenNeedsRefresh(userId: UserId, minutes?: number): Promise<boolean>;

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
   * @param userId The user id to check for external authN status.
   * @returns A promise that resolves with a boolean representing the user's external authN status.
   */
  abstract getIsExternal(userId: UserId): Promise<boolean>;

  /** Gets the active or passed in user's security stamp */
  abstract getSecurityStamp(userId?: UserId): Promise<string | null>;

  /** Sets the security stamp for the active or passed in user */
  abstract setSecurityStamp(securityStamp: string, userId?: UserId): Promise<void>;
}
