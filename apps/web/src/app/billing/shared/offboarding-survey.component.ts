import { CurrencyPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators } from "@angular/forms";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductTierType } from "@bitwarden/common/billing/enums/product-tier-type.enum";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  providers: [CurrencyPipe],
})
export class OffboardingSurveyComponent implements OnInit {
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

  private readonly configService = inject(ConfigService);
  private readonly organizationBillingClient = inject(OrganizationBillingClient);
  private readonly logService = inject(LogService);
  private readonly currencyPipe = inject(CurrencyPipe);

  protected readonly annualUpgradeOffer = signal<AnnualUpgradeOfferResponseModel | null>(null);
  // The business-reason `value` strings are legacy backend cancellation codes that do
  // not line up with their labels: value "too_complex" is the "Cost was too high"
  // option (value "too_expensive" is "Our needs changed"). The annual-upgrade callout
  // attaches to the cost option.
  protected readonly annualOfferReasonValue = "too_complex";
  protected readonly annualUpgradeRedeemLoading = signal(false);
  protected readonly annualUpgradeRedeemError = signal<string | null>(null);
  protected readonly cancellationLoading = signal(false);

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

  ngOnInit() {
    if (this.dialogParams.type === "Organization") {
      void this.loadAnnualUpgradeOffer(this.dialogParams.id);
    }
  }

  private async loadAnnualUpgradeOffer(organizationId: string): Promise<void> {
    // Checked here as well as on the server. The endpoint answers 404 when the flag is off, and
    // the catch below swallows and logs that, so an unguarded call would put an error in the log
    // for every cancellation dialog in a flag-off environment.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.PM38333_AnnualBillingSavings))) {
      return;
    }

    // Best-effort: the offer is a bonus prompt, so a failure to load it is logged and
    // swallowed, leaving the survey fully usable without the offer.
    try {
      this.annualUpgradeOffer.set(
        await this.organizationBillingClient.getAnnualUpgradeOffer(
          organizationId as OrganizationId,
        ),
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

  readonly switchToAnnualBilling = async () => {
    if (this.dialogParams.type !== "Organization") {
      return;
    }

    this.annualUpgradeRedeemLoading.set(true);
    this.annualUpgradeRedeemError.set(null);

    try {
      await this.organizationBillingClient.redeemAnnualUpgradeOffer(
        this.dialogParams.id as OrganizationId,
      );

      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("switchedToAnnualBilling"),
      });

      await this.dialogRef.close(this.ResultType.Submitted);
    } catch (e) {
      this.logService.error(e);
      this.annualUpgradeRedeemError.set(this.i18nService.t("unexpectedError"));
    } finally {
      this.annualUpgradeRedeemLoading.set(false);
    }
  };

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

    this.cancellationLoading.set(true);

    try {
      this.dialogParams.type === "Organization"
        ? await this.billingApiService.cancelOrganizationSubscription(this.dialogParams.id, request)
        : await this.billingApiService.cancelPremiumUserSubscription(request);

      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("canceledSubscription"),
      });

      await this.dialogRef.close(this.ResultType.Submitted);
    } finally {
      this.cancellationLoading.set(false);
    }
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
