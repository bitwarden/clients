import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

import { PreloginRequest } from "../models/request/prelogin.request";
import { PreloginResponse } from "../models/response/prelogin.response";

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
