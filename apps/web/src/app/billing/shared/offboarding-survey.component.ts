// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

type UserOffboardingParams = {
  type: "User";
};

type OrganizationOffboardingParams = {
  type: "Organization";
  id: string;
};

export type OffboardingSurveyDialogParams = UserOffboardingParams | OrganizationOffboardingParams;

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class OffboardingSurveyComponent {
  protected ResultType = OffboardingSurveyDialogResultType;
  protected readonly MaxFeedbackLength = 400;

  protected readonly reasons: Reason[] = [];

  protected formGroup = this.formBuilder.group({
    reason: [null, [Validators.required]],
    feedback: ["", [Validators.maxLength(this.MaxFeedbackLength)]],
  });

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: OffboardingSurveyDialogParams,
    private dialogRef: DialogRef<OffboardingSurveyDialogResultType>,
    private formBuilder: FormBuilder,
    private billingApiService: BillingApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {
    this.reasons = [
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
      this.getSwitchingReason(),
      {
        value: "other",
        text: this.i18nService.t("other"),
      },
    ];
  }

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
      ? await this.billingApiService.cancelOrganizationSubscription(this.dialogParams.id, request)
      : await this.billingApiService.cancelPremiumUserSubscription(request);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("canceledSubscription"),
    });

    this.dialogRef.close(this.ResultType.Submitted);
  };

  private getSwitchingReason(): Reason {
    return this.dialogParams.type === "Organization"
      ? {
          value: "switching_to_free_org",
          text: this.i18nService.t("switchToFreeOrg"),
        }
      : {
          value: "switching_to_free_plan",
          text: this.i18nService.t("switchToFreePlan"),
        };
  }
}
