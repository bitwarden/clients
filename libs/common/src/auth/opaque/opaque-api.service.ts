import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

import { LoginFinishRequest } from "./models/login-finish.request";
import { LoginStartRequest } from "./models/login-start.request";
import { LoginStartResponse } from "./models/login-start.response";
import { RegistrationFinishRequest } from "./models/registration-finish.request";
import { RegistrationFinishResponse } from "./models/registration-finish.response";
import { RegistrationStartRequest } from "./models/registration-start.request";
import { RegistrationStartResponse } from "./models/registration-start.response";

export class OpaqueApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async registrationStart(request: RegistrationStartRequest): Promise<RegistrationStartResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/start-registration`,
      request,
      true,
      true,
      env.getApiUrl(),
    );
    return new RegistrationStartResponse(response);
  }

  async registrationFinish(
    request: RegistrationFinishRequest,
  ): Promise<RegistrationFinishResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/finish-registration`,
      request,
      true,
      true,
      env.getApiUrl(),
    );
    return new RegistrationFinishResponse(response);
  }

  async loginStart(request: LoginStartRequest): Promise<LoginStartResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/start-login`,
      request,
      true,
      true,
      env.getApiUrl(),
    );
    return new LoginStartResponse(response);
  }

  async loginFinish(request: LoginFinishRequest): Promise<boolean> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/finish-login`,
      request,
      true,
      true,
      env.getApiUrl(),
    );
    return response.success;
  }
}
