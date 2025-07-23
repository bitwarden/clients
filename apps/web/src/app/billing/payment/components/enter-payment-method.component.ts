import { Component, Input, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, of, startWith, Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PopoverModule, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { BillingServicesModule, BraintreeService, StripeService } from "../../services";
import { PaymentLabelComponent } from "../../shared/payment/payment-label.component";
import {
  isTokenizablePaymentMethod,
  selectableCountries,
  TokenizablePaymentMethod,
  TokenizedPaymentMethod,
} from "../types";

type PaymentMethodOption = TokenizablePaymentMethod | "accountCredit";

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
  template: `
    @let showBillingDetails = includeBillingAddress && selected !== "payPal";
    <form [formGroup]="group">
      @if (showBillingDetails) {
        <h5 bitTypography="h5">{{ "paymentMethod" | i18n }}</h5>
      }
      <div class="tw-mb-4 tw-text-lg">
        <bit-radio-group [formControl]="group.controls.type">
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
          @if (showPayPal) {
            <bit-radio-button id="paypal-payment-method" [value]="'payPal'">
              <bit-label>
                <i class="bwi bwi-fw bwi-paypal" aria-hidden="true"></i>
                {{ "payPal" | i18n }}
              </bit-label>
            </bit-radio-button>
          }
          @if (showAccountCredit) {
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
              <app-payment-label for="stripe-card-number" required>
                {{ "number" | i18n }}
              </app-payment-label>
              <div id="stripe-card-number" class="tw-stripe-form-control"></div>
            </div>
            <div class="tw-col-span-1 tw-flex tw-items-end">
              <img
                src="../../../images/cards.png"
                alt="Visa, MasterCard, Discover, AmEx, JCB, Diners Club, UnionPay"
                class="tw-max-w-full"
              />
            </div>
            <div class="tw-col-span-1">
              <app-payment-label for="stripe-card-expiry" required>
                {{ "expiration" | i18n }}
              </app-payment-label>
              <div id="stripe-card-expiry" class="tw-stripe-form-control"></div>
            </div>
            <div class="tw-col-span-1">
              <app-payment-label for="stripe-card-cvc" required>
                {{ "securityCodeSlashCVV" | i18n }}
                <button
                  [bitPopoverTriggerFor]="cardSecurityCodePopover"
                  type="button"
                  class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
                  [position]="'above-end'"
                >
                  <i class="bwi bwi-question-circle tw-text-lg" aria-hidden="true"></i>
                </button>
                <bit-popover [title]="'cardSecurityCode' | i18n" #cardSecurityCodePopover>
                  <p>{{ "cardSecurityCodeDescription" | i18n }}</p>
                </bit-popover>
              </app-payment-label>
              <div id="stripe-card-cvc" class="tw-stripe-form-control"></div>
            </div>
          </div>
        }
        @case ("bankAccount") {
          <ng-container>
            <bit-callout type="warning" title="{{ 'verifyBankAccount' | i18n }}">
              {{ "verifyBankAccountWarning" | i18n }}
            </bit-callout>
            <div class="tw-grid tw-grid-cols-2 tw-gap-4 tw-mb-4" formGroupName="bankAccount">
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "routingNumber" | i18n }}</bit-label>
                <input
                  bitInput
                  id="routingNumber"
                  type="text"
                  [formControl]="group.controls.bankAccount.controls.routingNumber"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "accountNumber" | i18n }}</bit-label>
                <input
                  bitInput
                  id="accountNumber"
                  type="text"
                  [formControl]="group.controls.bankAccount.controls.accountNumber"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "accountHolderName" | i18n }}</bit-label>
                <input
                  id="accountHolderName"
                  bitInput
                  type="text"
                  [formControl]="group.controls.bankAccount.controls.accountHolderName"
                  required
                />
              </bit-form-field>
              <bit-form-field class="tw-col-span-1" [disableMargin]="true">
                <bit-label>{{ "bankAccountType" | i18n }}</bit-label>
                <bit-select
                  id="accountHolderType"
                  [formControl]="group.controls.bankAccount.controls.accountHolderType"
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
            <bit-callout type="info">
              {{ "makeSureEnoughCredit" | i18n }}
            </bit-callout>
          </ng-container>
        }
      }
      @if (showBillingDetails) {
        <h5 bitTypography="h5">{{ "billingAddress" | i18n }}</h5>
        <div class="tw-grid tw-grid-cols-12 tw-gap-4">
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "country" | i18n }}</bit-label>
              <bit-select [formControl]="group.controls.billingAddress.controls.country">
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
              <bit-label>{{ "zipPostalCode" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.billingAddress.controls.postalCode"
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
export class EnterPaymentMethodComponent implements OnInit {
  @Input({ required: true }) group!: PaymentMethodFormGroup;

  @Input() private showBankAccount = true;
  @Input() showPayPal = true;
  @Input() showAccountCredit = false;
  @Input() includeBillingAddress = false;

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
      {
        cardNumber: "#stripe-card-number",
        cardExpiry: "#stripe-card-expiry",
        cardCvc: "#stripe-card-cvc",
      },
      true,
    );

    if (this.showPayPal) {
      this.braintreeService.loadBraintree("#braintree-container", false);
    }

    if (!this.includeBillingAddress) {
      this.showBankAccount$ = of(this.showBankAccount);
      this.group.controls.billingAddress.disable();
    } else {
      this.group.controls.billingAddress.patchValue({
        country: "US",
      });
      this.showBankAccount$ = this.group.controls.billingAddress.controls.country.valueChanges.pipe(
        startWith(this.group.controls.billingAddress.controls.country.value),
        map((country) => this.showBankAccount && country === "US"),
      );
    }

    this.group.controls.type.valueChanges
      .pipe(startWith(this.group.controls.type.value), takeUntil(this.destroy$))
      .subscribe((selected) => {
        if (selected === "bankAccount") {
          this.group.controls.bankAccount.enable();
          if (this.includeBillingAddress) {
            this.group.controls.billingAddress.enable();
          }
        } else {
          switch (selected) {
            case "card": {
              this.stripeService.mountElements();
              if (this.includeBillingAddress) {
                this.group.controls.billingAddress.enable();
              }
              break;
            }
            case "payPal": {
              this.braintreeService.createDropin();
              if (this.includeBillingAddress) {
                this.group.controls.billingAddress.disable();
              }
              break;
            }
          }
          this.group.controls.bankAccount.disable();
        }
      });

    this.showBankAccount$.pipe(takeUntil(this.destroy$)).subscribe((showBankAccount) => {
      if (!showBankAccount && this.selected === "bankAccount") {
        this.select("card");
      }
    });
  }

  select = (paymentMethod: PaymentMethodOption) =>
    this.group.controls.type.patchValue(paymentMethod);

  tokenize = async (): Promise<TokenizedPaymentMethod> => {
    const exchange = async (paymentMethod: TokenizablePaymentMethod) => {
      switch (paymentMethod) {
        case "bankAccount": {
          this.group.controls.bankAccount.markAllAsTouched();
          if (!this.group.controls.bankAccount.valid) {
            throw new Error("Attempted to tokenize invalid bank account information.");
          }

          const bankAccount = this.group.controls.bankAccount.getRawValue();
          const clientSecret = await this.stripeService.createSetupIntent("bankAccount");
          const billingDetails = this.group.controls.billingAddress.enabled
            ? this.group.controls.billingAddress.getRawValue()
            : undefined;
          return await this.stripeService.setupBankAccountPaymentMethod(
            clientSecret,
            bankAccount,
            billingDetails,
          );
        }
        case "card": {
          const clientSecret = await this.stripeService.createSetupIntent("card");
          const billingDetails = this.group.controls.billingAddress.enabled
            ? this.group.controls.billingAddress.getRawValue()
            : undefined;
          return this.stripeService.setupCardPaymentMethod(clientSecret, billingDetails);
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
      this.logService.error(error);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("problemSubmittingPaymentMethod"),
      });
      throw error;
    }
  };

  validate = (): boolean => {
    if (this.selected === "bankAccount") {
      this.group.controls.bankAccount.markAllAsTouched();
      return this.group.controls.bankAccount.valid;
    }

    return true;
  };

  get selected(): PaymentMethodOption {
    return this.group.value.type!;
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
