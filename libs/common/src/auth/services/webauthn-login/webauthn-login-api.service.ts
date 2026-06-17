import { firstValueFrom } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";

import { CredentialAssertionOptionsResponse } from "./response/credential-assertion-options.response";

export class WebAuthnLoginApiService implements WebAuthnLoginApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
  ) {}

  async getCredentialAssertionOptions(): Promise<CredentialAssertionOptionsResponse> {
    // Use the global environment because the user-scoped environment is not set until authentication is complete.
    const env = await firstValueFrom(this.environmentService.globalEnvironment$);
    const response = await this.apiService.send(
      "GET",
      `/accounts/webauthn/assertion-options`,
      null,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new CredentialAssertionOptionsResponse(response);
  }
}
