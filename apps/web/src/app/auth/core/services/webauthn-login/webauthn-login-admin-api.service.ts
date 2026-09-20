import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { CredentialAssertionOptionsResponse } from "@bitwarden/common/auth/services/webauthn-login/response/credential-assertion-options.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserId } from "@bitwarden/common/types/guid";

import { EnableCredentialEncryptionRequest } from "./request/enable-credential-encryption.request";
import { SaveCredentialRequest } from "./request/save-credential.request";
import { WebauthnLoginCredentialCreateOptionsResponse } from "./response/webauthn-login-credential-create-options.response";
import { WebauthnLoginCredentialResponse } from "./response/webauthn-login-credential.response";

@Injectable({ providedIn: "root" })
export class WebAuthnLoginAdminApiService {
  constructor(private apiService: ApiService) {}

  async getCredentialCreateOptions(
    request: SecretVerificationRequest,
    userId: UserId,
  ): Promise<WebauthnLoginCredentialCreateOptionsResponse> {
    const response = await this.apiService.send(
      "POST",
      "/webauthn/attestation-options",
      request,
      userId,
      true,
    );
    return new WebauthnLoginCredentialCreateOptionsResponse(response);
  }

  async getCredentialAssertionOptions(
    request: SecretVerificationRequest,
    userId: UserId,
  ): Promise<CredentialAssertionOptionsResponse> {
    const response = await this.apiService.send(
      "POST",
      "/webauthn/assertion-options",
      request,
      userId,
      true,
    );
    return new CredentialAssertionOptionsResponse(response);
  }

  async saveCredential(request: SaveCredentialRequest, userId: UserId): Promise<boolean> {
    await this.apiService.send("POST", "/webauthn", request, userId, true);
    return true;
  }

  async getCredentials(userId: UserId): Promise<ListResponse<WebauthnLoginCredentialResponse>> {
    const response = await this.apiService.send("GET", "/webauthn", null, userId, true);
    return new ListResponse<WebauthnLoginCredentialResponse>(
      response,
      WebauthnLoginCredentialResponse,
    );
  }

  async deleteCredential(
    credentialId: string,
    request: SecretVerificationRequest,
    userId: UserId,
  ): Promise<void> {
    await this.apiService.send("POST", `/webauthn/${credentialId}/delete`, request, userId, true);
  }

  async updateCredential(
    request: EnableCredentialEncryptionRequest,
    userId: UserId,
  ): Promise<void> {
    await this.apiService.send("PUT", `/webauthn`, request, userId, true);
  }
}
