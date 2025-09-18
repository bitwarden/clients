// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { TokenizedPaymentSourceRequest } from "@bitwarden/common/billing/models/request/tokenized-payment-source.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../../../shared";
import { BillingServicesModule, BraintreeService, StripeService } from "../../services";

import { PaymentLabelComponent } from "./payment-label.component";

/**
 * Render a form that allows the user to enter their payment method, tokenize it against one of our payment providers and,
 * optionally, submit it using the {@link onSubmit} function if it is provided.
 */
@Component({
  selector: "app-payment",
  templateUrl: "./payment.component.html",
  imports: [BillingServicesModule, SharedModule, PaymentLabelComponent],
})
export class PaymentComponent implements OnInit, OnDestroy {
  /** Show account credit as a payment option. */
  @Input() showAccountCredit: boolean = true;
  /** Show bank account as a payment option. */
  @Input() showBankAccount: boolean = true;
  /** Show PayPal as a payment option. */
  @Input() showPayPal: boolean = true;

  /** The payment method selected by default when the component renders. */
  @Input() private initialPaymentMethod: PaymentMethodType = PaymentMethodType.Card;
  /** If provided, will be invoked with the tokenized payment source during form submission. */
  @Input() protected onSubmit?: (request: TokenizedPaymentSourceRequest) => Promise<void>;

  @Input() private bankAccountWarningOverride?: string;

  @Output() submitted = new EventEmitter<PaymentMethodType>();

  private destroy$ = new Subject<void>();

  protected formGroup = new FormGroup({
    paymentMethod: new FormControl<PaymentMethodType>(null),
    bankInformation: new FormGroup({
      routingNumber: new FormControl<string>("", [Validators.required]),
      accountNumber: new FormControl<string>("", [Validators.required]),
      accountHolderName: new FormControl<string>("", [Validators.required]),
      accountHolderType: new FormControl<string>("", [Validators.required]),
    }),
  });

  protected PaymentMethodType = PaymentMethodType;

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private braintreeService: BraintreeService,
    private i18nService: I18nService,
    private stripeService: StripeService,
  ) {}

  ngOnInit(): void {
    this.formGroup.controls.paymentMethod.patchValue(this.initialPaymentMethod);

    this.stripeService.loadStripe(
      {
        cardNumber: "#stripe-card-number",
        cardExpiry: "#stripe-card-expiry",
        cardCvc: "#stripe-card-cvc",
      },
      this.initialPaymentMethod === PaymentMethodType.Card,
    );

    if (this.showPayPal) {
      this.braintreeService.loadBraintree(
        "#braintree-container",
        this.initialPaymentMethod === PaymentMethodType.PayPal,
      );
    }

    this.formGroup
      .get("paymentMethod")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((type) => {
        this.onPaymentMethodChange(type);
      });
  }

  /** Programmatically select the provided payment method. */
  select = (paymentMethod: PaymentMethodType) => {
    this.formGroup.get("paymentMethod").patchValue(paymentMethod);
  };

  protected submit = async () => {
    const { type, token } = await this.tokenize();
    await this.onSubmit?.({ type, token });
    this.submitted.emit(type);
  };

  validate = () => {
    if (!this.usingBankAccount) {
      return true;
    }

    this.formGroup.controls.bankInformation.markAllAsTouched();
    return this.formGroup.controls.bankInformation.valid;
  };

  /**
   * Tokenize the payment method information entered by the user against one of our payment providers.
   *
   * - {@link PaymentMethodType.Card} => [Stripe.confirmCardSetup]{@link https://docs.stripe.com/js/setup_intents/confirm_card_setup}
   * - {@link PaymentMethodType.BankAccount} => [Stripe.confirmUsBankAccountSetup]{@link https://docs.stripe.com/js/setup_intents/confirm_us_bank_account_setup}
   * - {@link PaymentMethodType.PayPal} => [Braintree.requestPaymentMethod]{@link https://braintree.github.io/braintree-web-drop-in/docs/current/Dropin.html#requestPaymentMethod}
   * */
  async tokenize(): Promise<{ type: PaymentMethodType; token: string }> {
    const type = this.selected;

    if (this.usingStripe) {
      const clientSecret = await this.billingApiService.createSetupIntent(type);

      if (this.usingBankAccount) {
        this.formGroup.markAllAsTouched();
        if (this.formGroup.valid) {
          const token = await this.stripeService.setupBankAccountPaymentMethod(clientSecret, {
            accountHolderName: this.formGroup.value.bankInformation.accountHolderName,
            routingNumber: this.formGroup.value.bankInformation.routingNumber,
            accountNumber: this.formGroup.value.bankInformation.accountNumber,
            accountHolderType: this.formGroup.value.bankInformation.accountHolderType,
          });
          return {
            type,
            token,
          };
        } else {
          throw "Invalid input provided. Please ensure all required fields are filled out correctly and try again.";
        }
      }

      if (this.usingCard) {
        const token = await this.stripeService.setupCardPaymentMethod(clientSecret);
        return {
          type,
          token,
        };
      }
    }

    if (this.usingPayPal) {
      const token = await this.braintreeService.requestPaymentMethod();
      return {
        type,
        token,
      };
    }

    if (this.usingAccountCredit) {
      return {
        type: PaymentMethodType.Credit,
        token: null,
      };
    }

    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stripeService.unloadStripe();
    if (this.showPayPal) {
      this.braintreeService.unloadBraintree();
    }
  }

  private onPaymentMethodChange(type: PaymentMethodType): void {
    switch (type) {
      case PaymentMethodType.Card: {
        this.stripeService.mountElements();
        break;
      }
      case PaymentMethodType.PayPal: {
        this.braintreeService.createDropin();
        break;
      }
    }
  }

  get selected(): PaymentMethodType {
    return this.formGroup.value.paymentMethod;
  }

  protected get usingAccountCredit(): boolean {
    return this.selected === PaymentMethodType.Credit;
  }

  protected get usingBankAccount(): boolean {
    return this.selected === PaymentMethodType.BankAccount;
  }

  protected get usingCard(): boolean {
    return this.selected === PaymentMethodType.Card;
  }

  protected get usingPayPal(): boolean {
    return this.selected === PaymentMethodType.PayPal;
  }

  private get usingStripe(): boolean {
    return this.usingBankAccount || this.usingCard;
  }
}
