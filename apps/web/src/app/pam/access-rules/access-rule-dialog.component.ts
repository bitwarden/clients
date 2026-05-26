import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  RadioButtonModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRule,
  AccessRuleKind,
  AccessRuleRequest,
  AccessRuleResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type AccessRuleDialogData = {
  organizationId: string;
  /** Present in edit mode; absent for create. */
  existing?: AccessRuleResponse;
};

export type AccessRuleDialogResult = "saved";

const NAME_MAX_LENGTH = 256;

@Component({
  templateUrl: "./access-rule-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    RadioButtonModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessRuleDialogComponent {
  protected readonly data = inject<AccessRuleDialogData>(DIALOG_DATA);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogRef = inject<DialogRef<AccessRuleDialogResult>>(DialogRef);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly AccessRuleKind = AccessRuleKind;
  protected readonly editing = this.data.existing != null;

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: [
      this.data.existing?.name ?? "",
      [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    ],
    description: [this.data.existing?.description ?? ""],
    kind: [
      this.data.existing?.rule.kind ?? (AccessRuleKind.HumanApproval as AccessRuleKind),
      [Validators.required],
    ],
  });

  protected readonly kindIsEditableYet = computed(() => {
    return this.formGroup.controls.kind.value === AccessRuleKind.HumanApproval;
  });

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    if (value.kind !== AccessRuleKind.HumanApproval) {
      // Other kinds need editor stories (PM-37272/3/4/5). The template disables
      // submit in that case, but guard here too in case the disabled state is
      // bypassed.
      return;
    }

    const rule: AccessRule = { kind: "human_approval" };
    const request = new AccessRuleRequest({
      name: value.name,
      description: value.description.length === 0 ? null : value.description,
      rule,
    });

    try {
      if (this.data.existing != null) {
        await this.pamApi.updateAccessRule(
          this.data.organizationId,
          this.data.existing.id,
          request,
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleUpdated"),
        });
      } else {
        await this.pamApi.createAccessRule(this.data.organizationId, request);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleCreated"),
        });
      }
      await this.dialogRef.close("saved");
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  static open(
    dialogService: DialogService,
    config: DialogConfig<AccessRuleDialogData>,
  ): DialogRef<AccessRuleDialogResult> {
    return dialogService.open<AccessRuleDialogResult>(AccessRuleDialogComponent, config);
  }
}
