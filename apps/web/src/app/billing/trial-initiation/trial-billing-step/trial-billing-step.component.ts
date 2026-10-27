import { Component, computed, input, OnInit, output, viewChild } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { Discount, DiscountBadgeComponent } from "@bitwarden/pricing";
import {
  BillingAddressControls,
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { SubscriptionDiscountService } from "@bitwarden/web-vault/app/billing/services/subscription-discount.service";
import {
  Cadence,
  Cadences,
  Prices,
  Trial,
  TrialBillingStepService,
} from "@bitwarden/web-vault/app/billing/trial-initiation/trial-billing-step/trial-billing-step.service";
import { TrialPreviewCartComponent } from "@bitwarden/web-vault/app/billing/trial-initiation/trial-billing-step/trial-preview-cart.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export interface OrganizationCreatedEvent {
  organizationId: string;
  planDescription: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-trial-billing-step",
  templateUrl: "./trial-billing-step.component.html",
  imports: [
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    TrialPreviewCartComponent,
    SharedModule,
    DiscountBadgeComponent,
  ],
})
export class TrialBillingStepComponent implements OnInit {
  protected readonly enterPaymentMethodComponent = viewChild.required(EnterPaymentMethodComponent);

  protected readonly previewCart = viewChild(TrialPreviewCartComponent);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  protected trial = input.required<Trial>();
  protected steppedBack = output<void>();
  protected organizationCreated = output<OrganizationCreatedEvent>();

  protected prices$!: Observable<Prices>;

  protected selectionPrice$!: Observable<number>;
  protected selectionCosts$!: Observable<{
    tax: number;
    total: number;
  }>;
  protected selectionDescription$!: Observable<string>;

  /** Whether the preview-driven pricing is enabled — both cart flags on. */
  protected previewPricingEnabled$!: Observable<boolean>;

  protected formGroup = new FormGroup({
    cadence: new FormControl<Cadence>(Cadences.Annually, {
      nonNullable: true,
    }),
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  /** The cadence currently selected on the billing plan radios. */
  protected readonly cadenceSelected$ = this.formGroup.controls.cadence.valueChanges.pipe(
    startWith(Cadences.Annually),
  );

  /** The cadence value for the preview component — a FormControl isn't a signal. */
  protected readonly cadenceValue = toSignal(this.cadenceSelected$, {
    initialValue: Cadences.Annually,
  });

  /** The debounced billing address value for the preview component. */
  protected readonly billingAddressValue = toSignal(
    this.formGroup.controls.billingAddress.valueChanges.pipe(
      debounceTime(500),
      map(() => this.formGroup.controls.billingAddress.getRawValue()),
    ),
    { initialValue: this.formGroup.controls.billingAddress.getRawValue() },
  );

  protected readonly discountTierType = computed<DiscountTierType | null>(() =>
    this.trial().tier === "families" ? DiscountTierType.Families : null,
  );

  protected readonly eligibleDiscounts = toSignal(
    toObservable(this.discountTierType).pipe(
      switchMap(() => this.trialBillingStepService.getEligibleDiscounts$(this.trial().tier)),
    ),
    { initialValue: [] },
  );

  protected readonly cartDiscounts = computed<Discount[]>(() =>
    this.eligibleDiscounts()
      .map((d) => this.subscriptionDiscountService.mapToCartDiscount(d))
      .filter((d): d is Discount => d !== null),
  );

  private readonly eligibleCouponIds = computed<string[]>(() =>
    this.eligibleDiscounts().map((d: SubscriptionDiscount) => d.stripeCouponId),
  );

  private readonly eligibleDiscounts$ = toObservable(this.eligibleDiscounts);

  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private trialBillingStepService: TrialBillingStepService,
    private subscriptionDiscountService: SubscriptionDiscountService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.prices$ = this.trialBillingStepService.getPrices$(
      this.trial().product,
      this.trial().tier,
      this.trial().privilegedControls != null,
    );

    const billingAddressChanged$ = this.formGroup.controls.billingAddress.valueChanges.pipe(
      startWith(this.formGroup.controls.billingAddress.value),
      filter(
        (billingAddress): billingAddress is BillingAddressControls =>
          !!billingAddress.country && !!billingAddress.postalCode,
      ),
    );

    this.selectionPrice$ = this.getSelectionPrice$(this.cadenceSelected$);
    this.selectionCosts$ = this.getSelectionCosts$(this.cadenceSelected$, billingAddressChanged$);
    this.selectionDescription$ = this.getSelectionDescription$(this.cadenceSelected$);
    this.previewPricingEnabled$ = this.getPreviewPricingEnabled$();
  }

  private getSelectionPrice$(cadenceSelected$: Observable<Cadence>): Observable<number> {
    return combineLatest([this.prices$, cadenceSelected$]).pipe(
      map(([prices, cadence]) => prices[cadence]),
      filter((price): price is number => !!price),
    );
  }

  private getSelectionCosts$(
    cadenceSelected$: Observable<Cadence>,
    billingAddressChanged$: Observable<BillingAddressControls>,
  ): Observable<{ tax: number; total: number }> {
    return combineLatest([cadenceSelected$, billingAddressChanged$, this.eligibleDiscounts$]).pipe(
      debounceTime(500),
      switchMap(([cadence, billingAddress]) =>
        this.trialBillingStepService.getCosts(
          this.trial().product,
          this.trial().tier,
          cadence,
          billingAddress,
          this.trial().privilegedControls,
          this.eligibleCouponIds(),
        ),
      ),
      startWith({
        tax: 0,
        total: 0,
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private getSelectionDescription$(cadenceSelected$: Observable<Cadence>): Observable<string> {
    return combineLatest([this.selectionPrice$, cadenceSelected$]).pipe(
      map(([price, cadence]) => {
        switch (cadence) {
          case Cadences.Annually:
            return `${this.i18nService.t("annual")} ($${price}/${this.i18nService.t("yr")})`;
          case Cadences.Monthly:
            return `${this.i18nService.t("monthly")} ($${price}/${this.i18nService.t("monthAbbr")})`;
        }
      }),
    );
  }

  /** Gate the preview-driven pricing on both flags; the endpoint also requires PM36631 server-side. */
  private getPreviewPricingEnabled$(): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PamBillingSupport),
      this.configService.getFeatureFlag$(FeatureFlag.PM36631_PreviewDrivenCart),
    ]).pipe(
      map(([pamBillingSupport, previewDrivenCart]) => pamBillingSupport && previewDrivenCart),
      distinctUntilChanged(),
    );
  }

  /** Submit is allowed unless a rendered preview cart is still loading, erroring, or empty. */
  protected canSubmit(): boolean {
    const cart = this.previewCart();
    return cart == null || cart.canSubmit();
  }

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const paymentMethod = await this.enterPaymentMethodComponent().tokenize();
    if (!paymentMethod) {
      return;
    }

    const billingAddress = this.formGroup.controls.billingAddress.getRawValue();

    try {
      const organization = await this.trialBillingStepService.startTrial(
        this.trial(),
        this.formGroup.value.cadence!,
        billingAddress,
        paymentMethod,
        this.eligibleCouponIds(),
      );

      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("organizationCreated"),
        message: this.i18nService.t("organizationReadyToGo"),
      });

      this.organizationCreated.emit({
        organizationId: organization.id,
        planDescription: await firstValueFrom(this.selectionDescription$),
      });
    } catch (e: unknown) {
      if (this.subscriptionDiscountService.isDiscountExpiredError(e)) {
        this.subscriptionDiscountService.refresh();
        this.toastService.showToast({
          variant: "warning",
          title: "",
          message: this.i18nService.t("discountExpiredOnPurchase"),
        });
      } else {
        throw e;
      }
    }
  };

  protected stepBack = () => this.steppedBack.emit();
}
