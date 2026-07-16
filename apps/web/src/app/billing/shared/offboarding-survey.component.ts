// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { AnnualUpgradeOfferResponseModel, OrganizationBillingClient } from "../clients";

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
  providers: [CurrencyPipe],
})
export class OffboardingSurveyComponent implements OnInit {
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

  protected annualUpgradeOffer: AnnualUpgradeOfferResponseModel | null = null;
  // The business-reason `value` strings are legacy backend cancellation codes that do
  // not line up with their labels: value "too_complex" is the "We're not getting enough
  // value for the cost" option (value "too_expensive" is "Our needs changed"). The
  // annual-upgrade callout attaches to the cost option.
  protected readonly annualOfferReasonValue = "too_complex";
  protected annualUpgradeRedeemLoading = false;
  protected annualUpgradeRedeemError: string | null = null;

  protected formGroup = this.formBuilder.group({
    reason: [null, [Validators.required]],
    feedback: ["", [Validators.maxLength(this.MaxFeedbackLength)]],
  });

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: OffboardingSurveyDialogParams,
    private dialogRef: DialogRef<OffboardingSurveyDialogResultType>,
    private formBuilder: FormBuilder,
    private billingApiService: BillingApiService,
    private organizationBillingClient: OrganizationBillingClient,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private logService: LogService,
    private currencyPipe: CurrencyPipe,
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

  ngOnInit() {
    if (this.dialogParams.type === "Organization") {
      void this.loadAnnualUpgradeOffer(this.dialogParams.id);
    }
  }

  private async loadAnnualUpgradeOffer(organizationId: string): Promise<void> {
    // Best-effort: the offer is a bonus prompt, so a failure to load it is logged and
    // swallowed, leaving the survey fully usable without the offer.
    try {
      this.annualUpgradeOffer = await this.organizationBillingClient.getAnnualUpgradeOffer(
        organizationId as OrganizationId,
      );
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected formatCurrency(amount: number): string {
    // Mirror the price-increase-warning precedent: whole-dollar amounts show no cents,
    // fractional amounts show two decimals.
    const digitsInfo = Number.isInteger(amount) ? "1.0-0" : "1.2-2";
    return this.currencyPipe.transform(amount, "$", "symbol", digitsInfo) ?? `$${amount}`;
  }

  switchToAnnualBilling = async () => {
    if (this.dialogParams.type !== "Organization") {
      return;
    }

    this.annualUpgradeRedeemLoading = true;
    this.annualUpgradeRedeemError = null;

    try {
      await this.organizationBillingClient.redeemAnnualUpgradeOffer(
        this.dialogParams.id as OrganizationId,
      );

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("switchedToAnnualBilling"),
      });

      await this.dialogRef.close(this.ResultType.Submitted);
    } catch {
      this.annualUpgradeRedeemError = this.i18nService.t("unexpectedError");
    } finally {
      this.annualUpgradeRedeemLoading = false;
    }
  };

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
