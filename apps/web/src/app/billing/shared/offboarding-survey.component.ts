import { ChangeDetectionStrategy, Component, computed, Inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
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
  value: string | null;
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
  protected readonly ResultType = OffboardingSurveyDialogResultType;
  protected readonly MaxFeedbackLength = 400;

  protected readonly reasons: Reason[] = [];

  protected readonly businessReasons: BusinessReason[] = [
    {
      value: "missing_features",
      labelKey: "cancelSurveyMissingFeaturesLabel",
      hintKey: "cancelSurveyMissingFeaturesHintV2",
    },
    {
      value: "switched_service",
      labelKey: "cancelSurveyTooComplexLabel",
      hintKey: "cancelSurveyTooComplexHintV2",
    },
    {
      value: "too_complex",
      labelKey: "cancelSurveyNotEnoughValueLabelV2",
      hintKey: "cancelSurveyNotEnoughValueHintV2",
    },
    {
      value: "unused",
      labelKey: "cancelSurveyNotEnoughUsageLabel",
      hintKey: "cancelSurveyNotEnoughUsageHintV2",
    },
    {
      value: "too_expensive",
      labelKey: "cancelSurveyNeedsChangedLabel",
      hintKey: "cancelSurveyNeedsChangedHintV2",
    },
    {
      value: "customer_service",
      labelKey: "cancelSurveyPoorServiceLabel",
      hintKey: "cancelSurveyPoorServiceHint",
    },
    {
      value: "other",
      labelKey: "other",
      hintKey: null,
    },
  ];

  protected readonly isBusiness: boolean;

  protected readonly formGroup = this.formBuilder.group({
    reason: [null as string | null],
    feedback: ["", [Validators.maxLength(this.MaxFeedbackLength)]],
    otherFeedback: ["", [Validators.maxLength(this.MaxFeedbackLength)]],
  });

  protected readonly reason = toSignal(this.formGroup.controls.reason.valueChanges, {
    initialValue: this.formGroup.controls.reason.value,
  });

  protected readonly isOtherReason = computed(() => this.reason() === "other");

  constructor(
    @Inject(DIALOG_DATA) private readonly dialogParams: OffboardingSurveyDialogParams,
    private readonly dialogRef: DialogRef<OffboardingSurveyDialogResultType>,
    private readonly formBuilder: FormBuilder,
    private readonly billingApiService: BillingApiService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
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

  readonly submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const feedbackParts = this.isOtherReason()
      ? [this.formGroup.value.otherFeedback, this.formGroup.value.feedback]
      : [this.formGroup.value.feedback];

    const request = {
      reason: this.formGroup.value.reason!,
      feedback: feedbackParts.filter(Boolean).join("\n"),
    };

    this.dialogParams.type === "Organization"
      ? await this.billingApiService.cancelOrganizationSubscription(this.dialogParams.id, request)
      : await this.billingApiService.cancelPremiumUserSubscription(request);

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("canceledSubscription"),
    });

    await this.dialogRef.close(this.ResultType.Submitted);
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
