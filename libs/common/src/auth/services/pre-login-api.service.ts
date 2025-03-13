import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

import { PreloginRequest } from "../models/request/prelogin.request";
import { PreloginResponse } from "../models/response/prelogin.response";

// TODO: rename to PrePasswordLoginApiService as this is only used for pre-password login
// or consider a better name for what we are doing here: retrieving user's KDF settings or
// their opaque configuration (both password authentication mechanisms)
export class PreLoginApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async postPrelogin(request: PreloginRequest): Promise<PreloginResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const r = await this.apiService.send(
      "POST",
      "/accounts/prelogin",
      request,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new PreloginResponse(r);
  }
}
