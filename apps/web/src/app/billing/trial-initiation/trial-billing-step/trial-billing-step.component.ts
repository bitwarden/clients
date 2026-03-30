import { Component, computed, input, OnDestroy, OnInit, output, ViewChild } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import {
  catchError,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  Subject,
  firstValueFrom,
} from "rxjs";

import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
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
    SharedModule,
    DiscountBadgeComponent,
  ],
})
export class TrialBillingStepComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  protected trial = input.required<Trial>();
  protected steppedBack = output<void>();
  protected organizationCreated = output<OrganizationCreatedEvent>();

  private destroy$ = new Subject<void>();

  protected prices$!: Observable<Prices>;

  protected selectionPrice$!: Observable<number>;
  protected selectionCosts$!: Observable<{
    tax: number;
    total: number;
  }>;
  protected selectionDescription$!: Observable<string>;

  protected formGroup = new FormGroup({
    cadence: new FormControl<Cadence>(Cadences.Annually, {
      nonNullable: true,
    }),
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  protected readonly discountTierType = computed<DiscountTierType | null>(() =>
    this.trial().tier === "families" ? DiscountTierType.Families : null,
  );

  protected readonly eligibleDiscounts = toSignal(
    toObservable(this.discountTierType).pipe(
      switchMap((tier) =>
        tier
          ? this.subscriptionDiscountService
              .getEligibleDiscountsForTier$(tier)
              .pipe(catchError(() => of([])))
          : of([]),
      ),
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
  ) {}

  async ngOnInit() {
    const { product, tier } = this.trial();
    this.prices$ = this.trialBillingStepService.getPrices$(product, tier);

    const cadenceChanged = this.formGroup.controls.cadence.valueChanges.pipe(
      startWith(Cadences.Annually),
    );

    this.selectionPrice$ = combineLatest([this.prices$, cadenceChanged]).pipe(
      map(([prices, cadence]) => prices[cadence]),
      filter((price): price is number => !!price),
    );

    this.selectionCosts$ = combineLatest([
      cadenceChanged,
      this.formGroup.controls.billingAddress.valueChanges.pipe(
        startWith(this.formGroup.controls.billingAddress.value),
        filter(
          (billingAddress): billingAddress is BillingAddressControls =>
            !!billingAddress.country && !!billingAddress.postalCode,
        ),
      ),
      this.eligibleDiscounts$,
    ]).pipe(
      debounceTime(500),
      switchMap(([cadence, billingAddress]) =>
        this.trialBillingStepService.getCosts(
          product,
          tier,
          cadence,
          billingAddress,
          this.eligibleCouponIds(),
        ),
      ),
      startWith({
        tax: 0,
        total: 0,
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.selectionDescription$ = combineLatest([this.selectionPrice$, cadenceChanged]).pipe(
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
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
