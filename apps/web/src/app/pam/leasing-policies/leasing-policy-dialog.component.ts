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
  LeasingPolicy,
  LeasingPolicyKind,
  LeasingPolicyRequest,
  LeasingPolicyResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type LeasingPolicyDialogData = {
  organizationId: string;
  /** Present in edit mode; absent for create. */
  policy?: LeasingPolicyResponse;
};

export type LeasingPolicyDialogResult = "saved";

const NAME_MAX_LENGTH = 256;

@Component({
  templateUrl: "./leasing-policy-dialog.component.html",
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
export class LeasingPolicyDialogComponent {
  protected readonly data = inject<LeasingPolicyDialogData>(DIALOG_DATA);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogRef = inject<DialogRef<LeasingPolicyDialogResult>>(DialogRef);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly LeasingPolicyKind = LeasingPolicyKind;
  protected readonly editing = this.data.policy != null;

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: [
      this.data.policy?.name ?? "",
      [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    ],
    description: [this.data.policy?.description ?? ""],
    kind: [
      this.data.policy?.policy.kind ?? (LeasingPolicyKind.HumanApproval as LeasingPolicyKind),
      [Validators.required],
    ],
  });

  protected readonly kindIsEditableYet = computed(() => {
    return this.formGroup.controls.kind.value === LeasingPolicyKind.HumanApproval;
  });

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    if (value.kind !== LeasingPolicyKind.HumanApproval) {
      // Other kinds need editor stories (PM-37272/3/4/5). The template disables
      // submit in that case, but guard here too in case the disabled state is
      // bypassed.
      return;
    }

    const policy: LeasingPolicy = { kind: "human_approval" };
    const request = new LeasingPolicyRequest({
      name: value.name,
      description: value.description.length === 0 ? null : value.description,
      policy,
    });

    try {
      if (this.data.policy != null) {
        await this.pamApi.updateLeasingPolicy(
          this.data.organizationId,
          this.data.policy.id,
          request,
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamLeasingPolicyUpdated"),
        });
      } else {
        await this.pamApi.createLeasingPolicy(this.data.organizationId, request);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamLeasingPolicyCreated"),
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
    config: DialogConfig<LeasingPolicyDialogData>,
  ): DialogRef<LeasingPolicyDialogResult> {
    return dialogService.open<LeasingPolicyDialogResult>(LeasingPolicyDialogComponent, config);
  }
}
