// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnDestroy, OnInit, inject } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Subject, startWith, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-subscribe",
  templateUrl: "sm-subscribe.component.html",
  standalone: false,
})
export class SecretsManagerSubscribeComponent implements OnInit, OnDestroy {
  private i18nService = inject(I18nService);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() formGroup: FormGroup<ControlsOf<SecretsManagerSubscription>>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() upgradeOrganization: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showSubmitButton = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() selectedPlan: PlanResponse;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() customerDiscount: BillingCustomerDiscount;

  productTypes = ProductTierType;

  private destroy$ = new Subject<void>();

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
