// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, filter, firstValueFrom, map, switchMap, take } from "rxjs";
import { Opaque } from "type-fest";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { decodeJwtTokenToJson } from "@bitwarden/auth/common";

import { Utils } from "../../platform/misc/utils";
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
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_MEMORY,
  SECURITY_STAMP_MEMORY,
  TOKEN_STORAGE_HYDRATED,
} from "./token.state";

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
  private emailTwoFactorTokenRecordGlobalState: GlobalState<Record<string, string>>;

  private activeUserIdGlobalState: GlobalState<UserId>;

  /**
   * Gate that suspends every token-read until `TokenStorageSyncService` has finished
   * hydrating disk → memory. Without this, a subscriber that fires before `init()` resolves
   * gets a transient `null` / `false` even when disk has a token (e.g. a quick auth-status
   * check could redirect the user to login mid-bootstrap).
   *
   * `take(1)` collapses the gate after the first `true` — `switchMap`/`firstValueFrom` then
   * forward the inner memory observable normally for the rest of the session. The flag is
   * memory-backed (resets on app restart), so the next session re-suspends until init runs
   * again.
   *
   * `TokenService` only *reads* this flag; it's published by `TokenStorageSyncService.init()`.
   */
  private readonly hydrated$: Observable<true>;

  constructor(
    // Note: we cannot use ActiveStateProvider because if we ever want to inject
    // this service into the AccountService, we will make a circular dependency
    private singleUserStateProvider: SingleUserStateProvider,
    private globalStateProvider: GlobalStateProvider,
  ) {
    this.initializeState();
    this.hydrated$ = this.globalStateProvider.get(TOKEN_STORAGE_HYDRATED).state$.pipe(
      filter((v): v is true => v === true),
      take(1),
    );
  }

  hasAccessToken$(userId: UserId): Observable<boolean> {
    return this.hydrated$.pipe(
      switchMap(() => this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).state$),
      map((token) => Boolean(token)),
    );
  }

  accessToken$(userId: UserId): Observable<string | null> {
    return this.hydrated$.pipe(
      switchMap(() => this.singleUserStateProvider.get(userId, ACCESS_TOKEN_MEMORY).state$),
    );
  }

  refreshToken$(userId: UserId): Observable<string | null> {
    return this.hydrated$.pipe(
      switchMap(() => this.singleUserStateProvider.get(userId, REFRESH_TOKEN_MEMORY).state$),
    );
  }

  clientId$(userId: UserId): Observable<string | null> {
    return this.hydrated$.pipe(
      switchMap(() => this.singleUserStateProvider.get(userId, API_KEY_CLIENT_ID_MEMORY).state$),
    );
  }

  clientSecret$(userId: UserId): Observable<string | null> {
    return this.hydrated$.pipe(
      switchMap(
        () => this.singleUserStateProvider.get(userId, API_KEY_CLIENT_SECRET_MEMORY).state$,
      ),
    );
  }

  private initializeState(): void {
    this.emailTwoFactorTokenRecordGlobalState = this.globalStateProvider.get(
      EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
    );

    this.activeUserIdGlobalState = this.globalStateProvider.get(ACCOUNT_ACTIVE_ACCOUNT_ID);
  }

  async setTokens(
    accessToken: string,
    refreshToken?: string,
    clientIdClientSecret?: [string, string],
  ): Promise<SetTokensResult> {
    if (!accessToken) {
      throw new Error("Access token is required.");
    }

    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    if (!userId) {
      throw new Error("User id not found. Cannot set tokens.");
    }

    const newAccessToken = await this._setAccessToken(accessToken, userId);
    const newTokens = new SetTokensResult(newAccessToken);

    if (refreshToken) {
      newTokens.refreshToken = await this.setRefreshToken(refreshToken, userId);
    }

    if (clientIdClientSecret != null) {
      const clientId = await this.setClientId(clientIdClientSecret[0], userId);
      const clientSecret = await this.setClientSecret(clientIdClientSecret[1], userId);
      newTokens.clientIdSecretPair = [clientId, clientSecret];
    }
    return newTokens;
  }

  /**
   * Internal helper for set access token which always requires user id.
   * This is useful because setTokens always will have a user id from the access token whereas
   * the public setAccessToken method does not.
   */
  private async _setAccessToken(accessToken: string, userId: UserId): Promise<string> {
    return await this.singleUserStateProvider
      .get(userId, ACCESS_TOKEN_MEMORY)
      .update((_) => accessToken, {
        shouldUpdate: (previousValue) => previousValue !== accessToken,
      });
  }

  async setAccessToken(accessToken: string): Promise<string> {
    if (!accessToken) {
      throw new Error("Access token is required.");
    }
    const userId: UserId = await this.getUserIdFromAccessToken(accessToken);

    if (!userId) {
      throw new Error("User id not found. Cannot save access token.");
    }

    return await this._setAccessToken(accessToken, userId);
  }

  async getAccessToken(userId: UserId): Promise<string | null> {
    if (!userId) {
      return null;
    }

    await firstValueFrom(this.hydrated$);
    return await this.getStateValueByUserIdAndKeyDef(userId, ACCESS_TOKEN_MEMORY);
  }

  // Private because we only ever set the refresh token when also setting the access token
  // and we need the user id from the access token to save to the correct location.
  private async setRefreshToken(refreshToken: string, userId: UserId): Promise<string> {
    if (!userId) {
      throw new Error("User id not found. Cannot save refresh token.");
    }

    return await this.singleUserStateProvider
      .get(userId, REFRESH_TOKEN_MEMORY)
      .update((_) => refreshToken, {
        shouldUpdate: (previousValue) => previousValue !== refreshToken,
      });
  }

  async getRefreshToken(userId: UserId): Promise<string | null> {
    if (!userId) {
      return null;
    }

    await firstValueFrom(this.hydrated$);
    return await this.getStateValueByUserIdAndKeyDef(userId, REFRESH_TOKEN_MEMORY);
  }

  async setClientId(clientId: string, userId?: UserId): Promise<string> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot save client id.");
    }

    return await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_ID_MEMORY)
      .update((_) => clientId);
  }

  async getClientId(userId: UserId): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    await firstValueFrom(this.hydrated$);
    return await this.getStateValueByUserIdAndKeyDef(userId, API_KEY_CLIENT_ID_MEMORY);
  }

  async setClientSecret(clientSecret: string, userId?: UserId): Promise<string> {
    userId ??= await firstValueFrom(this.activeUserIdGlobalState.state$);

    if (!userId) {
      throw new Error("User id not found. Cannot save client secret.");
    }

    return await this.singleUserStateProvider
      .get(userId, API_KEY_CLIENT_SECRET_MEMORY)
      .update((_) => clientSecret);
  }

  async getClientSecret(userId: UserId): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    await firstValueFrom(this.hydrated$);
    return await this.getStateValueByUserIdAndKeyDef(userId, API_KEY_CLIENT_SECRET_MEMORY);
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
}
