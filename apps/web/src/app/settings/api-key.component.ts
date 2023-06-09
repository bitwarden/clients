import { Component } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/abstractions/userVerification/userVerification.service.abstraction";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { ApiKeyResponse } from "@bitwarden/common/auth/models/response/api-key.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Verification } from "@bitwarden/common/types/verification";

@Component({
  selector: "app-api-key",
  templateUrl: "api-key.component.html",
})
export class ApiKeyComponent {
  keyType: string;
  isRotation: boolean;
  postKey: (entityId: string, request: SecretVerificationRequest) => Promise<ApiKeyResponse>;
  entityId: string;
  scope: string;
  grantType: string;
  apiKeyTitle: string;
  apiKeyWarning: string;
  apiKeyDescription: string;

  masterPassword: Verification;
  formPromise: Promise<ApiKeyResponse>;
  clientId: string;
  clientSecret: string;

  constructor(
    private userVerificationService: UserVerificationService,
    private logService: LogService
  ) {}

  async submit() {
    try {
      this.formPromise = this.userVerificationService
        .buildRequest(this.masterPassword)
        .then((request) => this.postKey(this.entityId, request));
      const response = await this.formPromise;
      this.clientSecret = response.apiKey;
      this.clientId = `${this.keyType}.${this.entityId}`;
    } catch (e) {
      this.logService.error(e);
    }
  }
}
