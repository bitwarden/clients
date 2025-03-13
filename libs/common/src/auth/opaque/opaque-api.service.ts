import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

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

  loginStart(): any {
    throw new Error("Method not implemented");
  }
  loginFinish(): any {
    throw new Error("Method not implemented");
  }
}
