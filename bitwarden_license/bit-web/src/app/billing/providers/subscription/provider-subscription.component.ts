// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, concatMap, takeUntil } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import {
  ProviderPlanResponse,
  ProviderSubscriptionResponse,
} from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-provider-subscription",
  templateUrl: "./provider-subscription.component.html",
})
export class ProviderSubscriptionComponent implements OnInit, OnDestroy {
  private providerId: string;
  protected subscription: ProviderSubscriptionResponse;

  protected firstLoaded = false;
  protected loading: boolean;
  private destroy$ = new Subject<void>();
  protected totalCost: number;

  protected readonly TaxInformation = TaxInformation;

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.providerId = params.providerId;
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
    this.subscription = await this.billingApiService.getProviderSubscription(this.providerId);
    this.totalCost =
      ((100 - this.subscription.discountPercentage) / 100) * this.sumCost(this.subscription.plans);
    this.loading = false;
  }

  protected updateTaxInformation = async (taxInformation: TaxInformation) => {
    const request = ExpandedTaxInfoUpdateRequest.From(taxInformation);
    await this.billingApiService.updateProviderTaxInformation(this.providerId, request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("updatedTaxInformation"),
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
}
