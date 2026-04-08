import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationApiKeyType } from "@bitwarden/common/admin-console/enums";
import { OrganizationApiKeyRequest } from "@bitwarden/common/admin-console/models/request/organization-api-key.request";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface ScimApiKeyDialogData {
  organizationId: string;
  isRotation: boolean;
}

export interface ScimApiKeyDialogResult {
  apiKey: string;
}

@Component({
  standalone: true,
  templateUrl: "scim-api-key-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    AsyncActionsModule,
    CalloutModule,
    FormFieldModule,
    UserVerificationFormInputComponent,
  ],
})
export class ScimApiKeyDialogComponent {
  protected readonly data = inject<ScimApiKeyDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ScimApiKeyDialogResult>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly userVerificationService = inject(UserVerificationService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);

  protected readonly clientSecret = signal<string | undefined>(undefined);

  readonly formGroup = this.formBuilder.group({
    verification: [null as Verification | null, Validators.required],
  });

  get isRotation(): boolean {
    return this.data.isRotation;
  }

  readonly submit = async () => {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    const verification = this.formGroup.controls.verification.value;
    if (verification == null) {
      return;
    }

    const request = await this.userVerificationService.buildRequest<OrganizationApiKeyRequest>(
      verification,
      OrganizationApiKeyRequest,
    );
    request.type = OrganizationApiKeyType.Scim;

    const response = this.isRotation
      ? await this.organizationApiService.rotateApiKey(this.data.organizationId, request)
      : await this.organizationApiService.getOrCreateApiKey(this.data.organizationId, request);

    this.clientSecret.set(response.apiKey);
  };

  close() {
    const secret = this.clientSecret();
    this.dialogRef.close(secret ? { apiKey: secret } : undefined);
  }

  static open(dialogService: DialogService, data: ScimApiKeyDialogData) {
    return dialogService.open<ScimApiKeyDialogResult>(ScimApiKeyDialogComponent, { data });
  }
}
