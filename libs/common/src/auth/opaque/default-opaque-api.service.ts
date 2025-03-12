import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

import { OpaqueSessionId } from "../../types/guid";

import { RegistrationFinishRequest } from "./models/registration-finish.request";
import { RegistrationFinishResponse } from "./models/registration-finish.response";
import { RegistrationStartRequest } from "./models/registration-start.request";
import { RegistrationStartResponse } from "./models/registration-start.response";
import { OpaqueApiService } from "./opaque-api.service";

export class DefaultOpaqueApiService implements OpaqueApiService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async RegistrationStart(request: RegistrationStartRequest): Promise<RegistrationStartResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/registration-start`,
      request,
      false,
      true,
      env.getApiUrl(),
    );
    return new RegistrationStartResponse(response);
  }

  async RegistrationFinish(
    credentialId: OpaqueSessionId,
    request: RegistrationFinishRequest,
  ): Promise<RegistrationFinishResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const response = await this.apiService.send(
      "POST",
      `/opaque/${credentialId}registration-start`,
      request,
      false,
      true,
      env.getApiUrl(),
    );
    return new RegistrationFinishResponse(response);
  }

  LoginStart(): any {
    throw new Error("Method not implemented");
  }
  LoginFinish(): any {
    throw new Error("Method not implemented");
  }
}
