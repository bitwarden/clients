import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

import { PrePasswordLoginRequest } from "../models/request/pre-password-login.request";
import { PrePasswordLoginResponse } from "../models/response/pre-password-login.response";

/**
 * An API service which facilitates retrieving key derivation information
 * required for password-based login before the user has authenticated.
 */
export class PrePasswordLoginApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async postPrePasswordLogin(request: PrePasswordLoginRequest): Promise<PrePasswordLoginResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const r = await this.apiService.send(
      "POST",
      "/accounts/prelogin",
      request,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new PrePasswordLoginResponse(r);
  }
}
