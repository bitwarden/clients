// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
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
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { TokenProvider } from "@bitwarden/token-provider";

import { ApiServiceAbstraction } from "./abstractions/api.service";
import { HttpOperations } from "./http-operations";

export class ApiService implements ApiServiceAbstraction {
  private device: DeviceType;
  private deviceType: string;
  private refreshTokenPromise: Promise<string> | undefined;

  /**
   * The message (responseJson.ErrorModel.Message) that comes back from the server when a new device verification is required.
   */
  private static readonly NEW_DEVICE_VERIFICATION_REQUIRED_MESSAGE =
    "new device verification required";

  constructor(
    private tokenService: TokenService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private appIdService: AppIdService,
    private refreshAccessTokenErrorCallback: () => void,
    private logService: LogService,
    private logoutCallback: (logoutReason: LogoutReason) => Promise<void>,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly httpOperations: HttpOperations,
    private tokenProvider: TokenProvider,
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
    return this.tokenProvider.postIdentityToken(request);
  }

  async refreshIdentityToken(): Promise<any> {
    return this.tokenProvider.refreshIdentityToken();
  }

  async getActiveBearerToken(): Promise<string> {
    return this.tokenProvider.getActiveBearerToken();
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

  async send(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body: any,
    authed: boolean,
    hasResponse: boolean,
    apiUrl?: string | null,
    alterHeaders?: (headers: Headers) => void,
  ): Promise<any> {
    const env = await firstValueFrom(this.environmentService.environment$);
    apiUrl = Utils.isNullOrWhitespace(apiUrl) ? env.getApiUrl() : apiUrl;

    // Prevent directory traversal from malicious paths
    const pathParts = path.split("?");
    const requestUrl =
      apiUrl + Utils.normalizePath(pathParts[0]) + (pathParts.length > 1 ? `?${pathParts[1]}` : "");

    const [requestHeaders, requestBody] = await this.buildHeadersAndBody(
      authed,
      hasResponse,
      body,
      alterHeaders,
    );

    const requestInit: RequestInit = {
      cache: "no-store",
      credentials: await this.getCredentials(),
      method: method,
    };
    requestInit.headers = requestHeaders;
    requestInit.body = requestBody;
    const response = await this.fetch(this.httpOperations.createRequest(requestUrl, requestInit));

    const responseType = response.headers.get("content-type");
    const responseIsJson = responseType != null && responseType.indexOf("application/json") !== -1;
    const responseIsCsv = responseType != null && responseType.indexOf("text/csv") !== -1;
    if (hasResponse && response.status === 200 && responseIsJson) {
      const responseJson = await response.json();
      return responseJson;
    } else if (hasResponse && response.status === 200 && responseIsCsv) {
      return await response.text();
    } else if (response.status !== 200 && response.status !== 204) {
      const error = await this.handleError(response, false, authed);
      return Promise.reject(error);
    }
  }

  private async buildHeadersAndBody(
    authed: boolean,
    hasResponse: boolean,
    body: any,
    alterHeaders: (headers: Headers) => void,
  ): Promise<[Headers, any]> {
    let requestBody: any = null;
    const headers = new Headers({
      "Device-Type": this.deviceType,
    });

    if (flagEnabled("prereleaseBuild")) {
      headers.set("Is-Prerelease", "1");
    }
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }
    if (hasResponse) {
      headers.set("Accept", "application/json");
    }
    if (alterHeaders != null) {
      alterHeaders(headers);
    }
    if (authed) {
      const authHeader = await this.getActiveBearerToken();
      headers.set("Authorization", "Bearer " + authHeader);
    } else {
      // For unauthenticated requests, we need to tell the server what the device is for flag targeting,
      // since it won't be able to get it from the access token.
      const appId = await this.appIdService.getAppId();
      headers.set("Device-Identifier", appId);
    }

    if (body != null) {
      if (typeof body === "string") {
        requestBody = body;
        headers.set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
      } else if (typeof body === "object") {
        if (body instanceof FormData) {
          requestBody = body;
        } else {
          headers.set("Content-Type", "application/json; charset=utf-8");
          requestBody = JSON.stringify(body);
        }
      }
    }

    return [headers, requestBody];
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

  // Token refresh helpers (same behavior as ApiService)
  private async internalRefreshToken(): Promise<string> {
    const refreshToken = await this.tokenService.getRefreshToken();
    if (refreshToken != null && refreshToken !== "") {
      return this.refreshAccessToken();
    }

    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();
    if (!Utils.isNullOrWhitespace(clientId) && !Utils.isNullOrWhitespace(clientSecret)) {
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
