// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, lastValueFrom, Subject, takeUntil } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { VerifyBankAccountRequest } from "@bitwarden/common/billing/models/request/verify-bank-account.request";
import {
  ProviderPlanResponse,
  ProviderSubscriptionResponse,
} from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import {
  AdjustPaymentDialogComponent,
  AdjustPaymentDialogResultType,
} from "@bitwarden/web-vault/app/billing/shared/adjust-payment-dialog/adjust-payment-dialog.component";

@Component({
  selector: "app-provider-subscription",
  templateUrl: "./provider-subscription.component.html",
  standalone: false,
})
export class ProviderSubscriptionComponent implements OnInit, OnDestroy {
  private providerId: string;
  protected subscription: ProviderSubscriptionResponse;

  protected firstLoaded = false;
  protected loading: boolean;
  private destroy$ = new Subject<void>();
  protected totalCost: number;
  protected managePaymentDetailsOutsideCheckout: boolean;

  protected readonly TaxInformation = TaxInformation;

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private billingNotificationService: BillingNotificationService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.providerId = params.providerId;
          this.managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
            FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
          );
          await this.load();
          this.firstLoaded = true;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  protected async load() {
    if (this.loading) {
      return;
    }
    this.loading = true;
    try {
      this.subscription = await this.billingApiService.getProviderSubscription(this.providerId);
      this.totalCost =
        ((100 - this.subscription.discountPercentage) / 100) *
        this.sumCost(this.subscription.plans);
    } catch (error) {
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading = false;
    }
  }

  protected updatePaymentMethod = async (): Promise<void> => {
    const dialogRef = AdjustPaymentDialogComponent.open(this.dialogService, {
      data: {
        initialPaymentMethod: this.subscription.paymentSource?.type,
        providerId: this.providerId,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AdjustPaymentDialogResultType.Submitted) {
      await this.load();
    }
  };

  protected updateTaxInformation = async (taxInformation: TaxInformation) => {
    try {
      const request = ExpandedTaxInfoUpdateRequest.From(taxInformation);
      await this.billingApiService.updateProviderTaxInformation(this.providerId, request);
      this.billingNotificationService.showSuccess(this.i18nService.t("updatedTaxInformation"));
    } catch (error) {
      this.billingNotificationService.handleError(error);
    }
  };

  protected verifyBankAccount = async (request: VerifyBankAccountRequest): Promise<void> => {
    await this.billingApiService.verifyProviderBankAccount(this.providerId, request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("verifiedBankAccount"),
    });
  };

  protected getFormattedCost(
    cost: number,
    seatMinimum: number,
    purchasedSeats: number,
    discountPercentage: number,
  ): number {
    const costPerSeat = cost / (seatMinimum + purchasedSeats);
    return costPerSeat - (costPerSeat * discountPercentage) / 100;
  }

  protected getFormattedPlanName(planName: string): string {
    const spaceIndex = planName.indexOf(" ");
    return planName.substring(0, spaceIndex);
  }

  protected getFormattedSeatCount(seatMinimum: number, purchasedSeats: number): string {
    const totalSeats = seatMinimum + purchasedSeats;
    return totalSeats > 1 ? totalSeats.toString() : "";
  }

  protected getFormattedPlanNameCadence(cadence: string) {
    return cadence === "Annual" ? "annually" : "monthly";
  }

  private sumCost(plans: ProviderPlanResponse[]): number {
    return plans.reduce((acc, plan) => acc + plan.cost, 0);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get activePlans(): ProviderPlanResponse[] {
    return this.subscription.plans.filter((plan) => {
      if (plan.purchasedSeats === 0) {
        return plan.seatMinimum > 0;
      } else {
        return plan.purchasedSeats > 0;
      }
    });
  }

  protected getBillingCadenceLabel(providerPlanResponse: ProviderPlanResponse): string {
    if (providerPlanResponse == null || providerPlanResponse == undefined) {
      return "month";
    }

    switch (providerPlanResponse.cadence) {
      case "Monthly":
        return "month";
      case "Annual":
        return "year";
      default:
        return "month";
    }
  }

  protected get paymentSourceClasses() {
    if (this.subscription.paymentSource == null) {
      return [];
    }
    switch (this.subscription.paymentSource.type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
      case PaymentMethodType.Check:
        return ["bwi-billing"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
  }

  protected get updatePaymentSourceButtonText(): string {
    const key =
      this.subscription.paymentSource == null ? "addPaymentMethod" : "changePaymentMethod";
    return this.i18nService.t(key);
  }
}
