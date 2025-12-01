import { ChangeDetectionStrategy, Component, input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, of, startWith, Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PopoverModule, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillingServicesModule, BraintreeService, StripeService } from "../../services";
import {
  AccountCreditPaymentMethod,
  isTokenizablePaymentMethod,
  selectableCountries,
  TokenizablePaymentMethod,
  TokenizedPaymentMethod,
} from "../types";

import { PaymentLabelComponent } from "./payment-label.component";

type PaymentMethodOption = TokenizablePaymentMethod | AccountCreditPaymentMethod;

type PaymentMethodFormGroup = FormGroup<{
  type: FormControl<PaymentMethodOption>;
  bankAccount: FormGroup<{
    routingNumber: FormControl<string>;
    accountNumber: FormControl<string>;
    accountHolderName: FormControl<string>;
    accountHolderType: FormControl<"" | "company" | "individual">;
  }>;
  billingAddress: FormGroup<{
    country: FormControl<string>;
    postalCode: FormControl<string>;
  }>;
}>;

@Component({
  selector: "app-enter-payment-method",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let showBillingDetails = includeBillingAddress() && selected !== "payPal";
    <form [formGroup]="group()">
      @if (showBillingDetails) {
        <h5 bitTypography="h5">{{ "paymentMethod" | i18n }}</h5>
      }
      <div class="tw-mb-4 tw-text-lg">
        <bit-radio-group [formControl]="group().controls.type">
          <bit-radio-button id="card-payment-method" [value]="'card'">
            <bit-label>
              <i class="bwi bwi-fw bwi-credit-card" aria-hidden="true"></i>
              {{ "creditCard" | i18n }}
            </bit-label>
          </bit-radio-button>
          @if (showBankAccount$ | async) {
            <bit-radio-button id="bank-payment-method" [value]="'bankAccount'">
              <bit-label>
                <i class="bwi bwi-fw bwi-billing" aria-hidden="true"></i>
                {{ "bankAccount" | i18n }}
              </bit-label>
            </bit-radio-button>
          }
          @if (showPayPal()) {
            <bit-radio-button id="paypal-payment-method" [value]="'payPal'">
              <bit-label>
                <i class="bwi bwi-fw bwi-paypal" aria-hidden="true"></i>
                {{ "payPal" | i18n }}
              </bit-label>
            </bit-radio-button>
          }
          @if (showAccountCredit()) {
            <bit-radio-button id="credit-payment-method" [value]="'accountCredit'">
              <bit-label>
                <i class="bwi bwi-fw bwi-dollar" aria-hidden="true"></i>
                {{ "accountCredit" | i18n }}
              </bit-label>
            </bit-radio-button>
          }
        </bit-radio-group>
      </div>
      @switch (selected) {
        @case ("card") {
          <div class="tw-grid tw-grid-cols-2 tw-gap-4 tw-mb-4">
            <div class="tw-col-span-1">
              <app-payment-label [for]="'stripe-card-number-' + instanceId" required>
                {{ "cardNumberLabel" | i18n }}
              </app-payment-label>
              <div [id]="'stripe-card-number-' + instanceId" class="tw-stripe-form-control"></div>
            </div>
            <div class="tw-col-span-1 tw-flex tw-items-end">
              <img
                src="../../../images/cards.png"
                alt="Visa, MasterCard, Discover, AmEx, JCB, Diners Club, UnionPay"
                class="tw-max-w-full"
              />
            </div>
            <div class="tw-col-span-1">
              <app-payment-label [for]="'stripe-card-expiry-' + instanceId" required>
                {{ "expiration" | i18n }}
              </app-payment-label>
              <div [id]="'stripe-card-expiry-' + instanceId" class="tw-stripe-form-control"></div>
            </div>
            <div class="tw-col-span-1">
              <app-payment-label [for]="'stripe-card-cvc-' + instanceId" required>
                {{ "securityCodeSlashCVV" | i18n }}
                <button
                  [bitPopoverTriggerFor]="cardSecurityCodePopover"
                  type="button"
                  class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-pr-1"
                  [position]="'above-end'"
                >
                  <i class="bwi bwi-question-circle tw-text-sm" aria-hidden="true"></i>
                </button>
                <bit-popover [title]="'cardSecurityCode' | i18n" #cardSecurityCodePopover>
                  <p class="tw-mb-0">{{ "cardSecurityCodeDescription" | i18n }}</p>
                </bit-popover>
              </app-payment-label>
              <div [id]="'stripe-card-cvc-' + instanceId" class="tw-stripe-form-control"></div>
            </div>
          </div>
        }
        @case ("bankAccount") {
          <ng-container>
            <bit-callout type="warning" title="{{ 'verifyBankAccount' | i18n }}">
              {{ "requiredToVerifyBankAccountWithStripe" | i18n }}
            </bit-callout>
            <div class="tw-grid tw-grid-cols-2 tw-gap-4 tw-mb-4" formGroupName="bankAccount">
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "routingNumber" | i18n }}</bit-label>
                <input
                  bitInput
                  id="routingNumber"
                  type="text"
                  [formControl]="group().controls.bankAccount.controls.routingNumber"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "accountNumber" | i18n }}</bit-label>
                <input
                  bitInput
                  id="accountNumber"
                  type="text"
                  [formControl]="group().controls.bankAccount.controls.accountNumber"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "accountHolderName" | i18n }}</bit-label>
                <input
                  id="accountHolderName"
                  bitInput
                  type="text"
                  [formControl]="group().controls.bankAccount.controls.accountHolderName"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "bankAccountType" | i18n }}</bit-label>
                <bit-select
                  id="accountHolderType"
                  [formControl]="group().controls.bankAccount.controls.accountHolderType"
                  required
                >
                  <bit-option [value]="''" label="-- {{ 'select' | i18n }} --"></bit-option>
                  <bit-option
                    [value]="'company'"
                    label="{{ 'bankAccountTypeCompany' | i18n }}"
                  ></bit-option>
                  <bit-option
                    [value]="'individual'"
                    label="{{ 'bankAccountTypeIndividual' | i18n }}"
                  ></bit-option>
                </bit-select>
              </bit-form-field>
            </div>
          </ng-container>
        }
        @case ("payPal") {
          <ng-container>
            <div class="tw-mb-3">
              <div id="braintree-container" class="tw-mb-1 tw-content-center"></div>
              <small class="tw-text-muted">{{ "paypalClickSubmit" | i18n }}</small>
            </div>
          </ng-container>
        }
        @case ("accountCredit") {
          <ng-container>
            @if (hasEnoughAccountCredit()) {
              <bit-callout type="info">
                {{ "makeSureEnoughCredit" | i18n }}
              </bit-callout>
            } @else {
              <bit-callout type="warning">
                {{ "notEnoughAccountCredit" | i18n }}
              </bit-callout>
            }
          </ng-container>
        }
      }
      @if (showBillingDetails) {
        <h5 bitTypography="h5" class="tw-pt-4">{{ "billingAddress" | i18n }}</h5>
        <div class="tw-grid tw-grid-cols-12 tw-gap-4">
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "country" | i18n }}</bit-label>
              <bit-select [formControl]="group().controls.billingAddress.controls.country">
                @for (selectableCountry of selectableCountries; track selectableCountry.value) {
                  <bit-option
                    [value]="selectableCountry.value"
                    [disabled]="selectableCountry.disabled"
                    [label]="selectableCountry.name"
                  ></bit-option>
                }
              </bit-select>
            </bit-form-field>
          </div>
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "zipPostalCodeLabel" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group().controls.billingAddress.controls.postalCode"
                autocomplete="postal-code"
              />
            </bit-form-field>
          </div>
        </div>
      }
    </form>
  `,
  standalone: true,
  imports: [BillingServicesModule, PaymentLabelComponent, PopoverModule, SharedModule],
})
export class EnterPaymentMethodComponent implements OnInit, OnDestroy {
  protected readonly instanceId = Utils.newGuid();

  readonly group = input.required<PaymentMethodFormGroup>();
  protected readonly showBankAccount = input(true);
  readonly showPayPal = input(true);
  readonly showAccountCredit = input(false);
  readonly hasEnoughAccountCredit = input(true);
  readonly includeBillingAddress = input(false);

  protected showBankAccount$!: Observable<boolean>;
  protected selectableCountries = selectableCountries;

  private destroy$ = new Subject<void>();

  constructor(
    private braintreeService: BraintreeService,
    private i18nService: I18nService,
    private logService: LogService,
    private stripeService: StripeService,
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    this.stripeService.loadStripe(
      this.instanceId,
      {
        cardNumber: `#stripe-card-number-${this.instanceId}`,
        cardExpiry: `#stripe-card-expiry-${this.instanceId}`,
        cardCvc: `#stripe-card-cvc-${this.instanceId}`,
      },
      true,
    );

    if (this.showPayPal()) {
      this.braintreeService.loadBraintree("#braintree-container", false);
    }

    if (!this.includeBillingAddress()) {
      this.showBankAccount$ = of(this.showBankAccount());
      this.group().controls.billingAddress.disable();
    } else {
      this.group().controls.billingAddress.patchValue({
        country: "US",
      });
      this.showBankAccount$ =
        this.group().controls.billingAddress.controls.country.valueChanges.pipe(
          startWith(this.group().controls.billingAddress.controls.country.value),
          map((country) => this.showBankAccount() && country === "US"),
        );
    }

    this.group()
      .controls.type.valueChanges.pipe(
        startWith(this.group().controls.type.value),
        takeUntil(this.destroy$),
      )
      .subscribe((selected) => {
        if (selected === "bankAccount") {
          this.group().controls.bankAccount.enable();
          if (this.includeBillingAddress()) {
            this.group().controls.billingAddress.enable();
          }
        } else {
          switch (selected) {
            case "card": {
              this.stripeService.mountElements(this.instanceId);
              if (this.includeBillingAddress()) {
                this.group().controls.billingAddress.enable();
              }
              break;
            }
            case "payPal": {
              this.braintreeService.createDropin();
              if (this.includeBillingAddress()) {
                this.group().controls.billingAddress.disable();
              }
              break;
            }
          }
          this.group().controls.bankAccount.disable();
        }
      });

    this.showBankAccount$.pipe(takeUntil(this.destroy$)).subscribe((showBankAccount) => {
      if (!showBankAccount && this.selected === "bankAccount") {
        this.select("card");
      }
    });
  }

  ngOnDestroy() {
    this.stripeService.unloadStripe(this.instanceId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  select = (paymentMethod: PaymentMethodOption) =>
    this.group().controls.type.patchValue(paymentMethod);

  tokenize = async (): Promise<TokenizedPaymentMethod | null> => {
    const exchange = async (paymentMethod: TokenizablePaymentMethod) => {
      switch (paymentMethod) {
        case "bankAccount": {
          this.group().controls.bankAccount.markAllAsTouched();
          if (!this.group().controls.bankAccount.valid) {
            throw new Error("Attempted to tokenize invalid bank account information.");
          }

          const bankAccount = this.group().controls.bankAccount.getRawValue();
          const clientSecret = await this.stripeService.createSetupIntent("bankAccount");
          const billingDetails = this.group().controls.billingAddress.enabled
            ? this.group().controls.billingAddress.getRawValue()
            : undefined;
          return await this.stripeService.setupBankAccountPaymentMethod(
            clientSecret,
            bankAccount,
            billingDetails,
          );
        }
        case "card": {
          const clientSecret = await this.stripeService.createSetupIntent("card");
          const billingDetails = this.group().controls.billingAddress.enabled
            ? this.group().controls.billingAddress.getRawValue()
            : undefined;
          return this.stripeService.setupCardPaymentMethod(
            this.instanceId,
            clientSecret,
            billingDetails,
          );
        }
        case "payPal": {
          return this.braintreeService.requestPaymentMethod();
        }
      }
    };

    if (!isTokenizablePaymentMethod(this.selected)) {
      throw new Error(`Attempted to tokenize a non-tokenizable payment method: ${this.selected}`);
    }

    try {
      const token = await exchange(this.selected);
      return { type: this.selected, token };
    } catch (error: unknown) {
      if (error) {
        this.logService.error(error);
        switch (this.selected) {
          case "card": {
            if (
              typeof error === "object" &&
              "message" in error &&
              typeof error.message === "string"
            ) {
              this.toastService.showToast({
                variant: "error",
                title: "",
                message: error.message,
              });
            }
            return null;
          }
          case "payPal": {
            if (typeof error === "string" && error === "No payment method is available.") {
              this.toastService.showToast({
                variant: "error",
                title: "",
                message: this.i18nService.t("clickPayWithPayPal"),
              });
              return null;
            }
          }
        }
        throw error;
      }
      return null;
    }
  };

  validate = (): boolean => {
    if (this.selected === "bankAccount") {
      this.group().controls.bankAccount.markAllAsTouched();
      return this.group().controls.bankAccount.valid;
    }

    return true;
  };

  get selected(): PaymentMethodOption {
    return this.group().value.type!;
  }

  static getFormGroup = (): PaymentMethodFormGroup =>
    new FormGroup({
      type: new FormControl<PaymentMethodOption>("card", { nonNullable: true }),
      bankAccount: new FormGroup({
        routingNumber: new FormControl<string>("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
        accountNumber: new FormControl<string>("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
        accountHolderName: new FormControl<string>("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
        accountHolderType: new FormControl<"" | "company" | "individual">("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
      }),
      billingAddress: new FormGroup({
        country: new FormControl<string>("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
        postalCode: new FormControl<string>("", {
          nonNullable: true,
          validators: [Validators.required],
        }),
      }),
    });
}
