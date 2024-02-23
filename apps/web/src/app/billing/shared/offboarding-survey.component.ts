import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { OrganizationBillingApiClient } from "@bitwarden/common/billing/services/organization-billing-api.client";
import { UserBillingApiClient } from "@bitwarden/common/billing/services/user-billing-api.client";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

type UserOffboardingParams = {
  type: "User";
};

type OrganizationOffboardingParams = {
  type: "Organization";
  id: string;
};

export type OffboardingSurveyDialogParams = UserOffboardingParams | OrganizationOffboardingParams;

export enum OffboardingSurveyDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

type Reason = {
  value: string;
  text: string;
};

export const openOffboardingSurvey = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<OffboardingSurveyDialogParams>,
) =>
  dialogService.open<OffboardingSurveyDialogResultType, OffboardingSurveyDialogParams>(
    OffboardingSurveyComponent,
    dialogConfig,
  );

@Component({
  selector: "app-cancel-subscription-form",
  templateUrl: "offboarding-survey.component.html",
})
export class OffboardingSurveyComponent {
  protected ResultType = OffboardingSurveyDialogResultType;
  protected readonly MaxFeedbackLength = 400;

  protected readonly reasons: Reason[] = [
    {
      value: null,
      text: this.i18nService.t("selectPlaceholder"),
    },
    {
      value: "missing_features",
      text: this.i18nService.t("missingFeatures"),
    },
    {
      value: "switched_service",
      text: this.i18nService.t("movingToAnotherTool"),
    },
    {
      value: "too_complex",
      text: this.i18nService.t("tooDifficultToUse"),
    },
    {
      value: "unused",
      text: this.i18nService.t("notUsingEnough"),
    },
    {
      value: "too_expensive",
      text: this.i18nService.t("tooExpensive"),
    },
    {
      value: "other",
      text: this.i18nService.t("other"),
    },
  ];

  protected formGroup = this.formBuilder.group({
    reason: [this.reasons[0].value, [Validators.required]],
    feedback: ["", [Validators.maxLength(this.MaxFeedbackLength)]],
  });

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: OffboardingSurveyDialogParams,
    private dialogRef: DialogRef<OffboardingSurveyDialogResultType>,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private organizationBillingApiClient: OrganizationBillingApiClient,
    private platformUtilsService: PlatformUtilsService,
    private userBillingApiClient: UserBillingApiClient,
  ) {}

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const request = {
      reason: this.formGroup.value.reason,
      feedback: this.formGroup.value.feedback,
    };

    this.dialogParams.type === "Organization"
      ? await this.organizationBillingApiClient.cancelSubscription(this.dialogParams.id, request)
      : await this.userBillingApiClient.cancelSubscription(request);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("canceledSubscription"),
    );

    this.dialogRef.close(this.ResultType.Submitted);
  };
}
