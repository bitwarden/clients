// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { DeviceRequest } from "@bitwarden/common/auth/models/request/identity-token/device.request";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/sso-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { UserApiTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/user-api-token.request";
import { WebAuthnLoginTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/webauthn-login-token.request";
import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout/enums/vault-timeout-action.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { flagEnabled } from "@bitwarden/common/platform/misc/flags";

import { TokenApiService } from "./token-api.service";

export type HttpOperations = {
  createRequest: (url: string, request: RequestInit) => Request;
};

export class DefaultTokenApiService implements TokenApiService {
  private device: DeviceType;
  private deviceType: string;
  private refreshTokenPromise: Promise<string> | undefined;

  /**
   * The message (responseJson.ErrorModel.Message) that comes back from the server when a new device verification is required.
   */
  private static readonly NEW_DEVICE_VERIFICATION_REQUIRED_MESSAGE =
    "new device verification required";

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private appIdService: AppIdService,
    private refreshAccessTokenErrorCallback: () => void,
    private logService: LogService,
    private logoutCallback: (logoutReason: LogoutReason) => Promise<void>,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private customUserAgent: string = null,
  ) {
    this.device = platformUtilsService.getDevice();
    this.deviceType = this.device.toString();
  }

  async postIdentityToken(
    request:
      | UserApiTokenRequest
      | PasswordTokenRequest
      | SsoTokenRequest
      | WebAuthnLoginTokenRequest,
  ): Promise<
    IdentityTokenResponse | IdentityTwoFactorResponse | IdentityDeviceVerificationResponse
  > {
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (flagEnabled("prereleaseBuild")) {
      headers.set("Is-Prerelease", "1");
    }
    if (flagEnabled("prereleaseBuild")) {
      headers.set("Is-Prerelease", "1");
    }
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }
    request.alterIdentityTokenHeaders(headers);

    const identityToken =
      request instanceof UserApiTokenRequest
        ? request.toIdentityToken()
        : request.toIdentityToken(this.platformUtilsService.getClientType());

    const env = await firstValueFrom(this.environmentService.environment$);

    const response = await this.fetch(
      this.httpOperations.createRequest(env.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify(identityToken),
        credentials: await this.getCredentials(),
        cache: "no-store",
        headers: headers,
        method: "POST",
      }),
    );

    let responseJson: any = null;
    if (this.isJsonResponse(response)) {
      responseJson = await response.json();
    }

    if (responseJson != null) {
      if (response.status === 200) {
        return new IdentityTokenResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson.TwoFactorProviders2 &&
        Object.keys(responseJson.TwoFactorProviders2).length
      ) {
        return new IdentityTwoFactorResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson?.ErrorModel?.Message ===
          TokenProviderService.NEW_DEVICE_VERIFICATION_REQUIRED_MESSAGE
      ) {
        return new IdentityDeviceVerificationResponse(responseJson);
      }
    }

    return Promise.reject(new ErrorResponse(responseJson, response.status, true));
  }

  async refreshIdentityToken(): Promise<any> {
    try {
      await this.refreshToken();
    } catch (e) {
      this.logService.error("Error refreshing access token: ", e);
      throw e;
    }
  }

  async getActiveBearerToken(): Promise<string> {
    let accessToken = await this.tokenService.getAccessToken();
    if (await this.tokenService.tokenNeedsRefresh()) {
      accessToken = await this.refreshToken();
    }
    return accessToken;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      request.headers.set("Cache-Control", "no-store");
      request.headers.set("Pragma", "no-cache");
    }
    request.headers.set("Bitwarden-Client-Name", this.platformUtilsService.getClientType());
    request.headers.set(
      "Bitwarden-Client-Version",
      await this.platformUtilsService.getApplicationVersionNumber(),
    );
    return this.nativeFetch(request);
  }

  nativeFetch(request: Request): Promise<Response> {
    return fetch(request);
  }

  private async handleError(
    response: Response,
    tokenError: boolean,
    authed: boolean,
  ): Promise<ErrorResponse> {
    let responseJson: any = null;
    if (this.isJsonResponse(response)) {
      responseJson = await response.json();
    } else if (this.isTextPlainResponse(response)) {
      responseJson = { Message: await response.text() };
    }

    if (authed) {
      if (
        response.status === 401 ||
        response.status === 403 ||
        (tokenError &&
          response.status === 400 &&
          responseJson != null &&
          responseJson.error === "invalid_grant")
      ) {
        await this.logoutCallback("invalidGrantError");
      }
    }

    return new ErrorResponse(responseJson, response.status, tokenError);
  }

  private qsStringify(params: any): string {
    return Object.keys(params)
      .map((key) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }

  private async getCredentials(): Promise<RequestCredentials> {
    const env = await firstValueFrom(this.environmentService.environment$);
    if (this.platformUtilsService.getClientType() !== ClientType.Web || env.hasBaseUrl()) {
      return "include";
    }
    return undefined;
  }

  private isJsonResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("application/json") > -1;
  }

  private isTextPlainResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("text/plain") > -1;
  }

  // Token refresh helpers (lift-and-shift parity with ApiService)
  private async internalRefreshToken(): Promise<string> {
    const refreshToken = await this.tokenService.getRefreshToken();
    if (refreshToken != null && refreshToken !== "") {
      return this.refreshAccessToken();
    }

    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();
    if (!clientId || !clientSecret) {
      // fall through
    } else {
      return this.refreshApiToken();
    }

    this.refreshAccessTokenErrorCallback();

    throw new Error("Cannot refresh access token, no refresh token or api keys are stored.");
  }

  protected refreshToken(): Promise<string> {
    if (this.refreshTokenPromise === undefined) {
      this.refreshTokenPromise = this.internalRefreshToken();
      void this.refreshTokenPromise.finally(() => {
        this.refreshTokenPromise = undefined;
      });
    }
    return this.refreshTokenPromise;
  }

  protected async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.tokenService.getRefreshToken();
    if (refreshToken == null || refreshToken === "") {
      throw new Error();
    }
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const env = await firstValueFrom(this.environmentService.environment$);
    const decodedToken = await this.tokenService.decodeAccessToken();
    const response = await this.fetch(
      this.httpOperations.createRequest(env.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify({
          grant_type: "refresh_token",
          client_id: decodedToken.client_id,
          refresh_token: refreshToken,
        }),
        cache: "no-store",
        credentials: await this.getCredentials(),
        headers: headers,
        method: "POST",
      }),
    );

    if (response.status === 200) {
      const responseJson = await response.json();
      const tokenResponse = new IdentityTokenResponse(responseJson);

      const newDecodedAccessToken = await this.tokenService.decodeAccessToken(
        tokenResponse.accessToken,
      );
      const userId = newDecodedAccessToken.sub;

      const vaultTimeoutAction = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
      );
      const vaultTimeout = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
      );

      const refreshedTokens = await this.tokenService.setTokens(
        tokenResponse.accessToken,
        vaultTimeoutAction as VaultTimeoutAction,
        vaultTimeout,
        tokenResponse.refreshToken,
      );
      return refreshedTokens.accessToken;
    } else {
      const error = await this.handleError(response, true, true);
      return Promise.reject(error);
    }
  }

  protected async refreshApiToken(): Promise<string> {
    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();

    const appId = await this.appIdService.getAppId();
    const deviceRequest = new DeviceRequest(appId, this.platformUtilsService);
    const tokenRequest = new UserApiTokenRequest(
      clientId,
      clientSecret,
      new TokenTwoFactorRequest(),
      deviceRequest,
    );

    const response = await this.postIdentityToken(tokenRequest);
    if (!(response instanceof IdentityTokenResponse)) {
      throw new Error("Invalid response received when refreshing api token");
    }

    const newDecodedAccessToken = await this.tokenService.decodeAccessToken(response.accessToken);
    const userId = newDecodedAccessToken.sub;

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
    );
    const vaultTimeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );

    const refreshedToken = await this.tokenService.setAccessToken(
      response.accessToken,
      vaultTimeoutAction as VaultTimeoutAction,
      vaultTimeout,
    );
    return refreshedToken;
  }
}
