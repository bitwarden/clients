// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CurrencyPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { startWith } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { SecretsManagerAlt } from "@bitwarden/assets/svg";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  TypographyModule,
  SvgModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    FormFieldModule,
    TypographyModule,
    SvgModule,
    I18nPipe,
    CurrencyPipe,
  ],
})
export class SecretsManagerSubscribeComponent implements OnInit {
  private readonly i18nService = inject(I18nService);
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly formGroup = input.required<FormGroup<ControlsOf<SecretsManagerSubscription>>>();
  readonly upgradeOrganization = input<boolean>(undefined);
  readonly showSubmitButton = input(false);
  readonly selectedPlan = input<PlanResponse>();
  readonly customerDiscount = input<BillingCustomerDiscount>(undefined);

  readonly logo = SecretsManagerAlt;
  readonly productTypes = ProductTierType;

  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  ngOnInit() {
    this.formGroup()
      .controls.enabled.valueChanges.pipe(
        startWith(this.formGroup().value.enabled),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((enabled) => {
        if (enabled) {
          this.formGroup().controls.userSeats.enable();
          this.formGroup().controls.additionalServiceAccounts.enable();
        } else {
          this.formGroup().controls.userSeats.disable();
          this.formGroup().controls.additionalServiceAccounts.disable();
        }
      });
  }

  readonly discountPrice = (price: number) => {
    const customerDiscount = this.customerDiscount();
    const discount =
      !!customerDiscount && customerDiscount.active
        ? price * (customerDiscount.percentOff / 100)
        : 0;

    return price - discount;
  };

  get product() {
    return this.selectedPlan().productTier;
  }

  get planName() {
    switch (this.product) {
      case ProductTierType.Free:
        return this.vfo1Enabled()
          ? this.i18nService.t("freePlanWithSharedVault")
          : this.i18nService.t("free2PersonOrganization");
      case ProductTierType.Teams:
      case ProductTierType.TeamsStarter:
        return this.i18nService.t("planNameTeams");
      case ProductTierType.Enterprise:
        return this.i18nService.t("planNameEnterprise");
    }
  }

  get serviceAccountsIncluded() {
    return this.selectedPlan().SecretsManager.baseServiceAccount;
  }

  get monthlyCostPerServiceAccount() {
    return this.selectedPlan().isAnnual
      ? this.discountPrice(this.selectedPlan().SecretsManager.additionalPricePerServiceAccount) / 12
      : this.discountPrice(this.selectedPlan().SecretsManager.additionalPricePerServiceAccount);
  }

  get maxUsers() {
    return this.selectedPlan().SecretsManager.maxSeats;
  }

  get maxProjects() {
    return this.selectedPlan().SecretsManager.maxProjects;
  }

  get monthlyCostPerUser() {
    return this.selectedPlan().isAnnual
      ? this.discountPrice(this.selectedPlan().SecretsManager.seatPrice) / 12
      : this.discountPrice(this.selectedPlan().SecretsManager.seatPrice);
  }
}
