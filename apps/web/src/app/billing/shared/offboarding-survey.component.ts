// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
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
  plan: PlanType;
  productTier: ProductTierType;
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

type BusinessReason = {
  value: string;
  labelKey: string;
  hintKey: string | null;
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

  protected readonly businessReasons: BusinessReason[] = [
    {
      value: "missing_features",
      labelKey: "cancelSurveyMissingFeaturesLabel",
      hintKey: "cancelSurveyMissingFeaturesHint",
    },
    {
      value: "switched_service",
      labelKey: "cancelSurveyTooComplexLabel",
      hintKey: "cancelSurveyTooComplexHint",
    },
    {
      value: "too_complex",
      labelKey: "cancelSurveyNotEnoughValueLabel",
      hintKey: "cancelSurveyNotEnoughValueHint",
    },
    {
      value: "unused",
      labelKey: "cancelSurveyNotEnoughUsageLabel",
      hintKey: "cancelSurveyNotEnoughUsageHint",
    },
    {
      value: "too_expensive",
      labelKey: "cancelSurveyNeedsChangedLabel",
      hintKey: "cancelSurveyNeedsChangedHint",
    },
    {
      value: "other",
      labelKey: "other",
      hintKey: null,
    },
  ];

  protected readonly isBusiness: boolean;

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
    this.isBusiness = this.isBusinessPlan();

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

  private isBusinessPlan(): boolean {
    return (
      this.dialogParams.type === "Organization" &&
      [ProductTierType.Teams, ProductTierType.Enterprise, ProductTierType.TeamsStarter].includes(
        this.dialogParams.productTier,
      )
    );
  }

  private getSwitchingReason(): Reason {
    if (this.dialogParams.type === "User") {
      return {
        value: "too_expensive",
        text: this.i18nService.t("switchToFreePlan"),
      };
    }

    const isFamilyPlan = [
      PlanType.FamiliesAnnually,
      PlanType.FamiliesAnnually2019,
      PlanType.FamiliesAnnually2025,
    ].includes(this.dialogParams.plan);

    return {
      value: "too_expensive",
      text: this.i18nService.t(isFamilyPlan ? "switchToFreeOrg" : "tooExpensive"),
    };
  }
}
