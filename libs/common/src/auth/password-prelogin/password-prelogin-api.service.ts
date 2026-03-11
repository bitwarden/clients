import { firstValueFrom } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";

import { PreloginRequest } from "./prelogin.request";
import { PreloginResponse } from "./prelogin.response";

export class PasswordPreloginApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async getPreloginData(request: PreloginRequest): Promise<PreloginResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const r = await this.apiService.send(
      "POST",
      "/accounts/prelogin/password",
      request,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new PreloginResponse(r);
  }
}
