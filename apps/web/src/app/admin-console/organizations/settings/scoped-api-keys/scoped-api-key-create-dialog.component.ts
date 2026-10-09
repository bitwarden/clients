import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationScopedApiKeyCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-scoped-api-key-create.request";
import { OrganizationScopedApiKeyCreatedResponse } from "@bitwarden/common/admin-console/models/response/organization-scoped-api-key-created.response";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";

import { ScopedApiKeyScopeGroups, ScopedApiKeyScopes } from "./scoped-api-key-scopes";

export type ScopedApiKeyCreateDialogData = {
  organizationId: string;
};

@Component({
  templateUrl: "scoped-api-key-create-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, UserVerificationFormInputComponent],
})
export class ScopedApiKeyCreateDialogComponent {
  private readonly data = inject<ScopedApiKeyCreateDialogData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<OrganizationScopedApiKeyCreatedResponse>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly userVerificationService = inject(UserVerificationService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly i18nService = inject(I18nService);

  protected readonly scopeGroups = ScopedApiKeyScopeGroups;

  protected readonly formGroup = this.formBuilder.group({
    name: ["", [Validators.required, Validators.maxLength(200)]],
    scopes: this.formBuilder.group(
      Object.fromEntries(ScopedApiKeyScopes.map((scope) => [scope.controlName, false])),
      { validators: (group) => this.atLeastOneScope(group) },
    ),
    expireAt: new FormControl<string | null>(null, [(control) => this.expiresInFuture(control)]),
    verification: new FormControl<Verification | null>(null, [Validators.required]),
  });

  private atLeastOneScope(group: AbstractControl): ValidationErrors | null {
    return Object.values(group.value ?? {}).some((selected) => selected === true)
      ? null
      : { scopesRequired: { message: this.i18nService.t("scopedApiKeyScopesRequired") } };
  }

  private expiresInFuture(control: AbstractControl<string | null>): ValidationErrors | null {
    if (!control.value || new Date(control.value).getTime() > Date.now()) {
      return null;
    }
    return { expiresInPast: { message: this.i18nService.t("scopedApiKeyExpirationInPast") } };
  }

  readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const { name, scopes, expireAt, verification } = this.formGroup.getRawValue();
    const request = await this.userVerificationService.buildRequest(
      verification!,
      OrganizationScopedApiKeyCreateRequest,
    );
    request.name = name!.trim();
    request.scopes = ScopedApiKeyScopes.filter((scope) => scopes[scope.controlName]).map(
      (scope) => scope.value,
    );
    request.expireAt = expireAt ? new Date(expireAt).toISOString() : undefined;

    const response = await this.organizationApiService.createScopedApiKey(
      this.data.organizationId,
      request,
    );
    await this.dialogRef.close(response);
  };

  static open(
    dialogService: DialogService,
    config: DialogConfig<ScopedApiKeyCreateDialogData, OrganizationScopedApiKeyCreatedResponse>,
  ) {
    return dialogService.open<
      OrganizationScopedApiKeyCreatedResponse,
      ScopedApiKeyCreateDialogData
    >(ScopedApiKeyCreateDialogComponent, config);
  }
}
