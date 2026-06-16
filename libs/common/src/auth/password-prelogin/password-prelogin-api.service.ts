import { firstValueFrom } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";

import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResponse } from "./password-prelogin.response";

export class PasswordPreloginApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async getPreloginData(request: PasswordPreloginRequest): Promise<PasswordPreloginResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const r = await this.apiService.send(
      "POST",
      "/accounts/prelogin/password",
      request,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new PasswordPreloginResponse(r);
  }
}
