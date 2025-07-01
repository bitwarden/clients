import { Component, Input, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { BehaviorSubject, startWith, Subject, takeUntil } from "rxjs";

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
  templateUrl: "./enter-payment-method.component.html",
  standalone: true,
  imports: [BillingServicesModule, PaymentLabelComponent, PopoverModule, SharedModule],
})
export class EnterPaymentMethodComponent implements OnInit {
  @Input({ required: true }) group!: PaymentMethodFormGroup;

  private showBankAccountSubject = new BehaviorSubject<boolean>(true);
  showBankAccount$ = this.showBankAccountSubject.asObservable();
  @Input()
  set showBankAccount(value: boolean) {
    this.showBankAccountSubject.next(value);
  }
  get showBankAccount(): boolean {
    return this.showBankAccountSubject.value;
  }

  @Input() showPayPal: boolean = true;
  @Input() showAccountCredit: boolean = false;
  @Input() includeBillingAddress: boolean = false;

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
      this.group.controls.billingAddress.disable();
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
