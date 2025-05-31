import { firstValueFrom } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { SendAccessTokenRequest } from "../../models/request/identity-token/send-access-token.request";
import { SendTokenApiService as SendTokenApiServiceAbstraction } from "../abstractions/send-token-api.service";
import { SendAccessToken } from "../models/send-access-token";

export type SendTokenApiRetrievalError =
  | "password-required"
  | "otp-required"
  | "invalid-password"
  | "invalid-otp"
  | "unknown-error";

export class SendTokenApiService implements SendTokenApiServiceAbstraction {
  constructor(
    private environmentService: EnvironmentService,
    private apiService: ApiService,
  ) {}

  async requestSendAccessToken(
    request: SendAccessTokenRequest,
  ): Promise<SendAccessToken | SendTokenApiRetrievalError> {
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
    const responseJson = await response.json();

    if (response.status === 200) {
      const sendAccessToken = SendAccessToken.fromJson(responseJson);
      return sendAccessToken;
    } else if (response.status === 400) {
      // TODO: add correct error handling for 400
      return "password-required";
    }

    return "unknown-error";
  }
}
