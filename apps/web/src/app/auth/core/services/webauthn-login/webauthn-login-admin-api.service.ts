import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { CredentialAssertionOptionsResponse } from "@bitwarden/common/auth/services/webauthn-login/response/credential-assertion-options.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { EnableCredentialEncryptionRequest } from "./request/enable-credential-encryption.request";
import { SaveCredentialRequest } from "./request/save-credential.request";
import { WebauthnLoginCredentialCreateOptionsResponse } from "./response/webauthn-login-credential-create-options.response";
import { WebauthnLoginCredentialResponse } from "./response/webauthn-login-credential.response";

@Injectable({ providedIn: "root" })
export class WebAuthnLoginAdminApiService {
  constructor(private apiService: ApiService) {}

  async getCredentialCreateOptions(
    request: SecretVerificationRequest,
  ): Promise<WebauthnLoginCredentialCreateOptionsResponse> {
    const response = await this.apiService.send(
      "POST",
      "/webauthn/attestation-options",
      request,
      true,
      true,
    );
    return new WebauthnLoginCredentialCreateOptionsResponse(response);
  }

  async getCredentialAssertionOptions(
    request: SecretVerificationRequest,
  ): Promise<CredentialAssertionOptionsResponse> {
    const response = await this.apiService.send(
      "POST",
      "/webauthn/assertion-options",
      request,
      true,
      true,
    );
    return new CredentialAssertionOptionsResponse(response);
  }

  async saveCredential(request: SaveCredentialRequest): Promise<boolean> {
    await this.apiService.send("POST", "/webauthn", request, true, true);
    return true;
  }

  async getCredentials(): Promise<ListResponse<WebauthnLoginCredentialResponse>> {
    const response = await this.apiService.send("GET", "/webauthn", null, true, true);
    return new ListResponse<WebauthnLoginCredentialResponse>(
      response,
      WebauthnLoginCredentialResponse,
    );
  }

  async deleteCredential(credentialId: string, request: SecretVerificationRequest): Promise<void> {
    await this.apiService.send("POST", `/webauthn/${credentialId}/delete`, request, true, true);
  }

  async updateCredential(request: EnableCredentialEncryptionRequest): Promise<void> {
    await this.apiService.send("PUT", `/webauthn`, request, true, true);
  }
}
