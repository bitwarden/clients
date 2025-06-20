import { firstValueFrom } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { SendAccessTokenRequest } from "../../models/request/identity-token/send-access-token.request";
import { SendTokenApiService as SendTokenApiServiceAbstraction } from "../abstractions/send-token-api.service";
import { SendAccessToken } from "../models/send-access-token";

export type SendTokenApiError =
  | "invalid-request"
  | "send-id-required"
  | "password-hash-required"
  | "email-and-otp-required"
  | "invalid-grant"
  | "invalid-password-hash"
  | "invalid-otp"
  | "json-parse-error"
  | "unknown-error";

const INVALID_REQUEST_ERROR_MAPPING: Record<string, SendTokenApiError> = {
  "send_id is required.": "send-id-required",
  "Password hash is required.": "password-hash-required",
  "": "invalid-request", // This is a catch-all for any null/undefined invalid request error descriptions
};

const INVALID_GRANT_ERROR_MAPPING: Record<string, SendTokenApiError> = {
  "Password hash invalid.": "invalid-password-hash",
  "Invalid OTP.": "invalid-otp",
  "": "invalid-grant", // This is a catch-all for any null/undefined invalid grant error descriptions
};

// TODO: add tests for this service.
export class SendTokenApiService implements SendTokenApiServiceAbstraction {
  constructor(
    private environmentService: EnvironmentService,
    private apiService: ApiService,
  ) {}

  async requestSendAccessToken(
    request: SendAccessTokenRequest,
  ): Promise<SendAccessToken | SendTokenApiError> {
    const payload = request.toIdentityTokenPayload();

    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
    });

    const credentials = await this.apiService.getCredentials();

    const env = await firstValueFrom(this.environmentService.environment$);

    const req = new Request(env.getIdentityUrl() + "/connect/token", {
      method: "POST",
      body: new URLSearchParams(payload as any),
      headers: headers,
      credentials: credentials,
      cache: "no-store",
    });

    const response = await this.apiService.fetch(req);

    // TODO: Determine if we need the isJsonResponse check here like API service
    let responseJson: any;
    try {
      responseJson = await response.json();
    } catch {
      // Only expected for server runtime exceptions or maybe CORS errors
      return "json-parse-error";
    }

    if (response.status === 200) {
      const sendAccessToken = SendAccessToken.fromResponseData(responseJson);
      return sendAccessToken;
    }

    if (response.status === 400 && responseJson?.error) {
      return this.mapTokenResponseToError(responseJson.error, responseJson.error_description);
    }

    // TODO: maybe log this error?
    return "unknown-error";
  }

  private mapTokenResponseToError(error: string, errorDescription?: string): SendTokenApiError {
    const errorDescKey = errorDescription ?? "";
    switch (error) {
      case "invalid_request": {
        return INVALID_REQUEST_ERROR_MAPPING[errorDescKey] || "invalid-request";
      }

      case "invalid_grant": {
        return INVALID_GRANT_ERROR_MAPPING[errorDescKey] || "invalid-grant";
      }

      default:
        return "unknown-error";
    }
  }
}
