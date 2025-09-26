import { Component, input, OnDestroy, OnInit, output, ViewChild } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import {
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
  Subject,
  firstValueFrom,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { TaxClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  BillingAddressControls,
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
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

@Component({
  selector: "app-trial-billing-step",
  templateUrl: "./trial-billing-step.component.html",
  imports: [EnterPaymentMethodComponent, EnterBillingAddressComponent, SharedModule],
  providers: [TaxClient, TrialBillingStepService],
})
export class TrialBillingStepComponent implements OnInit, OnDestroy {
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

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

  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private trialBillingStepService: TrialBillingStepService,
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
    ]).pipe(
      debounceTime(500),
      switchMap(([cadence, billingAddress]) =>
        this.trialBillingStepService.getCosts(product, tier, cadence, billingAddress),
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

    const organization = await this.trialBillingStepService.startTrial(
      this.trial(),
      this.formGroup.value.cadence!,
      billingAddress,
      paymentMethod,
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
  };

  protected stepBack = () => this.steppedBack.emit();
}
