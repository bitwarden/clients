// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { ApiKeyResponse } from "@bitwarden/common/auth/models/response/api-key.response";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { DIALOG_DATA, DialogConfig, DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

export type ApiKeyDialogData = {
  keyType: string;
  isRotation?: boolean;
  entityId: string;
  postKey: (entityId: string, request: SecretVerificationRequest) => Promise<ApiKeyResponse>;
  scope: string;
  grantType: string;
  apiKeyTitle: string;
  apiKeyWarning: string;
  apiKeyDescription: string;
};
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  templateUrl: "api-key.component.html",
  imports: [SharedModule, UserVerificationFormInputComponent],
})
export class ApiKeyComponent {
  clientId: string;
  clientSecret: string;

  formGroup = this.formBuilder.group({
    masterPassword: [null as Verification, [Validators.required]],
  });
  constructor(
    @Inject(DIALOG_DATA) protected data: ApiKeyDialogData,
    private formBuilder: FormBuilder,
    private userVerificationService: UserVerificationService,
  ) {}

  submit = async () => {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const response = await this.userVerificationService
      .buildRequest(this.formGroup.value.masterPassword)
      .then((request) => this.data.postKey(this.data.entityId, request));
    this.clientSecret = response.apiKey;
    this.clientId = `${this.data.keyType}.${this.data.entityId}`;
  };
  /**
   * Strongly typed helper to open a ApiKeyComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open = (dialogService: DialogService, config: DialogConfig<ApiKeyDialogData>) => {
    return dialogService.open(ApiKeyComponent, config);
  };
}
