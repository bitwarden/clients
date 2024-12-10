// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Subject, startWith, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SecretsManagerLogo } from "../../layouts/secrets-manager-logo";

export interface SecretsManagerSubscription {
  enabled: boolean;
  userSeats: number;
  additionalServiceAccounts: number;
}

export const secretsManagerSubscribeFormFactory = (
  formBuilder: FormBuilder,
): FormGroup<ControlsOf<SecretsManagerSubscription>> =>
  formBuilder.group({
    enabled: [false],
    userSeats: [1, [Validators.required, Validators.min(1), Validators.max(100000)]],
    additionalServiceAccounts: [
      0,
      [Validators.required, Validators.min(0), Validators.max(100000)],
    ],
  });

@Component({
  selector: "sm-subscribe",
  templateUrl: "sm-subscribe.component.html",
})
export class SecretsManagerSubscribeComponent implements OnInit, OnDestroy {
  @Input() formGroup: FormGroup<ControlsOf<SecretsManagerSubscription>>;
  @Input() upgradeOrganization: boolean;
  @Input() showSubmitButton = false;
  @Input() selectedPlan: PlanResponse;
  @Input() customerDiscount: BillingCustomerDiscount;

  logo = SecretsManagerLogo;
  productTypes = ProductTierType;

  private destroy$ = new Subject<void>();

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    this.formGroup.controls.enabled.valueChanges
      .pipe(startWith(this.formGroup.value.enabled), takeUntil(this.destroy$))
      .subscribe((enabled) => {
        if (enabled) {
          this.formGroup.controls.userSeats.enable();
          this.formGroup.controls.additionalServiceAccounts.enable();
        } else {
          this.formGroup.controls.userSeats.disable();
          this.formGroup.controls.additionalServiceAccounts.disable();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  discountPrice = (price: number) => {
    const discount =
      !!this.customerDiscount && this.customerDiscount.active
        ? price * (this.customerDiscount.percentOff / 100)
        : 0;

    return price - discount;
  };

  get product() {
    return this.selectedPlan.productTier;
  }

  get planName() {
    switch (this.product) {
      case ProductTierType.Free:
        return this.i18nService.t("free2PersonOrganization");
      case ProductTierType.Teams:
      case ProductTierType.TeamsStarter:
        return this.i18nService.t("planNameTeams");
      case ProductTierType.Enterprise:
        return this.i18nService.t("planNameEnterprise");
    }
  }

  get serviceAccountsIncluded() {
    return this.selectedPlan.SecretsManager.baseServiceAccount;
  }

  get monthlyCostPerServiceAccount() {
    return this.selectedPlan.isAnnual
      ? this.discountPrice(this.selectedPlan.SecretsManager.additionalPricePerServiceAccount) / 12
      : this.discountPrice(this.selectedPlan.SecretsManager.additionalPricePerServiceAccount);
  }

  get maxUsers() {
    return this.selectedPlan.SecretsManager.maxSeats;
  }

  get maxProjects() {
    return this.selectedPlan.SecretsManager.maxProjects;
  }

  get monthlyCostPerUser() {
    return this.selectedPlan.isAnnual
      ? this.discountPrice(this.selectedPlan.SecretsManager.seatPrice) / 12
      : this.discountPrice(this.selectedPlan.SecretsManager.seatPrice);
  }
}
