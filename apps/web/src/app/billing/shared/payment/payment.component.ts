import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { SharedModule } from "../../../shared";

import { PaymentLabelV2 } from "./payment-label-v2.component";

@Component({
  selector: "app-payment",
  templateUrl: "payment.component.html",
  standalone: true,
  imports: [SharedModule, PaymentLabelV2],
})
export class PaymentComponent implements OnInit, OnDestroy {
  @Input() showMethods = true;
  @Input() showOptions = true;
  @Input() hideBank = false;
  @Input() hidePaypal = false;
  @Input() hideCredit = false;
  @Input() trialFlow = false;

  @Input()
  set method(value: PaymentMethodType) {
    this._method = value;
    this.paymentForm?.controls.method.setValue(value, { emitEvent: false });
  }

  get method(): PaymentMethodType {
    return this._method;
  }
  private _method: PaymentMethodType = PaymentMethodType.Card;

  private destroy$ = new Subject<void>();
  protected paymentForm = new FormGroup({
    method: new FormControl(this.method),
    bank: new FormGroup({
      routing_number: new FormControl(null, [Validators.required]),
      account_number: new FormControl(null, [Validators.required]),
      account_holder_name: new FormControl(null, [Validators.required]),
      account_holder_type: new FormControl("", [Validators.required]),
      currency: new FormControl("USD"),
      country: new FormControl("US"),
    }),
  });
  paymentMethodType = PaymentMethodType;

  private btScript: HTMLScriptElement;
  private btInstance: any = null;
  private stripeScript: HTMLScriptElement;
  private stripe: any = null;
  private stripeElements: any = null;
  private stripeCardNumberElement: any = null;
  private stripeCardExpiryElement: any = null;
  private stripeCardCvcElement: any = null;
  private StripeElementStyle: any;
  private StripeElementClasses: any;

  constructor(
    private apiService: ApiService,
    private logService: LogService,
    private themingService: AbstractThemingService,
    private configService: ConfigService,
  ) {
    this.stripeScript = window.document.createElement("script");
    this.stripeScript.src = "https://js.stripe.com/v3/?advancedFraudSignals=false";
    this.stripeScript.async = true;
    this.stripeScript.onload = async () => {
      this.stripe = (window as any).Stripe(process.env.STRIPE_KEY);
      this.stripeElements = this.stripe.elements();
      await this.setStripeElement();
    };
    this.btScript = window.document.createElement("script");
    this.btScript.src = `scripts/dropin.js?cache=${process.env.CACHE_TAG}`;
    this.btScript.async = true;
    this.StripeElementStyle = {
      base: {
        color: null,
        fontFamily:
          '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif, ' +
          '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: "16px",
        fontSmoothing: "antialiased",
        "::placeholder": {
          color: null,
        },
      },
      invalid: {
        color: null,
      },
    };
    this.StripeElementClasses = {
      focus: "is-focused",
      empty: "is-empty",
      invalid: "is-invalid",
    };
  }
  async ngOnInit() {
    if (!this.showOptions) {
      this.hidePaypal = this.method !== PaymentMethodType.PayPal;
      this.hideBank = this.method !== PaymentMethodType.BankAccount;
      this.hideCredit = this.method !== PaymentMethodType.Credit;
    }
    this.subscribeToTheme();
    window.document.head.appendChild(this.stripeScript);
    if (!this.hidePaypal) {
      window.document.head.appendChild(this.btScript);
    }
    this.paymentForm
      .get("method")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        this.method = v;
        this.changeMethod();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    window.document.head.removeChild(this.stripeScript);
    window.setTimeout(() => {
      Array.from(window.document.querySelectorAll("iframe")).forEach((el) => {
        if (el.src != null && el.src.indexOf("stripe") > -1) {
          try {
            window.document.body.removeChild(el);
          } catch (e) {
            this.logService.error(e);
          }
        }
      });
    }, 500);
    if (!this.hidePaypal) {
      window.document.head.removeChild(this.btScript);
      window.setTimeout(() => {
        Array.from(window.document.head.querySelectorAll("script")).forEach((el) => {
          if (el.src != null && el.src.indexOf("paypal") > -1) {
            try {
              window.document.head.removeChild(el);
            } catch (e) {
              this.logService.error(e);
            }
          }
        });
        const btStylesheet = window.document.head.querySelector("#braintree-dropin-stylesheet");
        if (btStylesheet != null) {
          try {
            window.document.head.removeChild(btStylesheet);
          } catch (e) {
            this.logService.error(e);
          }
        }
      }, 500);
    }
  }

  changeMethod() {
    this.btInstance = null;
    if (this.method === PaymentMethodType.PayPal) {
      window.setTimeout(() => {
        (window as any).braintree.dropin.create(
          {
            authorization: process.env.BRAINTREE_KEY,
            container: "#bt-dropin-container",
            paymentOptionPriority: ["paypal"],
            paypal: {
              flow: "vault",
              buttonStyle: {
                label: "pay",
                size: "medium",
                shape: "pill",
                color: "blue",
                tagline: "false",
              },
            },
          },
          (createErr: any, instance: any) => {
            if (createErr != null) {
              // eslint-disable-next-line
              console.error(createErr);
              return;
            }
            this.btInstance = instance;
          },
        );
      }, 250);
    } else {
      void this.setStripeElement();
    }
  }

  createPaymentToken(): Promise<[string, PaymentMethodType]> {
    return new Promise((resolve, reject) => {
      if (this.method === PaymentMethodType.Credit) {
        resolve([null, this.method]);
      } else if (this.method === PaymentMethodType.PayPal) {
        this.btInstance
          .requestPaymentMethod()
          .then((payload: any) => {
            resolve([payload.nonce, this.method]);
          })
          .catch((err: any) => {
            reject(err.message);
          });
      } else if (
        this.method === PaymentMethodType.Card ||
        this.method === PaymentMethodType.BankAccount
      ) {
        if (this.method === PaymentMethodType.Card) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.apiService
            .postSetupPayment()
            .then((clientSecret) =>
              this.stripe.handleCardSetup(clientSecret, this.stripeCardNumberElement),
            )
            .then((result: any) => {
              if (result.error) {
                reject(result.error.message);
              } else if (result.setupIntent && result.setupIntent.status === "succeeded") {
                resolve([result.setupIntent.payment_method, this.method]);
              } else {
                reject();
              }
            });
        } else {
          this.stripe
            .createToken("bank_account", this.paymentForm.get("bank").value)
            .then((result: any) => {
              if (result.error) {
                reject(result.error.message);
              } else if (result.token && result.token.id != null) {
                resolve([result.token.id, this.method]);
              } else {
                reject();
              }
            });
        }
      }
    });
  }

  handleStripeCardPayment(clientSecret: string, successCallback: () => Promise<any>): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      if (this.showMethods && this.stripeCardNumberElement == null) {
        reject();
        return;
      }
      const handleCardPayment = () =>
        this.showMethods
          ? this.stripe.handleCardSetup(clientSecret, this.stripeCardNumberElement)
          : this.stripe.handleCardSetup(clientSecret);
      return handleCardPayment().then(async (result: any) => {
        if (result.error) {
          reject(result.error.message);
        } else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
          if (successCallback != null) {
            await successCallback();
          }
          resolve();
        } else {
          reject();
        }
      });
    });
  }

  private async setStripeElement() {
    const extensionRefreshFlag = await this.configService.getFeatureFlag(
      FeatureFlag.ExtensionRefresh,
    );

    // Apply unique styles for extension refresh
    if (extensionRefreshFlag) {
      this.StripeElementStyle.base.fontWeight = "500";
      this.StripeElementClasses.base = "v2";
    }

    window.setTimeout(() => {
      if (this.showMethods && this.method === PaymentMethodType.Card) {
        if (this.stripeCardNumberElement == null) {
          this.stripeCardNumberElement = this.stripeElements.create("cardNumber", {
            style: this.StripeElementStyle,
            classes: this.StripeElementClasses,
            placeholder: "",
          });
        }
        if (this.stripeCardExpiryElement == null) {
          this.stripeCardExpiryElement = this.stripeElements.create("cardExpiry", {
            style: this.StripeElementStyle,
            classes: this.StripeElementClasses,
          });
        }
        if (this.stripeCardCvcElement == null) {
          this.stripeCardCvcElement = this.stripeElements.create("cardCvc", {
            style: this.StripeElementStyle,
            classes: this.StripeElementClasses,
            placeholder: "",
          });
        }
        this.stripeCardNumberElement.mount("#stripe-card-number-element");
        this.stripeCardExpiryElement.mount("#stripe-card-expiry-element");
        this.stripeCardCvcElement.mount("#stripe-card-cvc-element");
      }
    }, 50);
  }

  private subscribeToTheme() {
    this.themingService.theme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const style = getComputedStyle(document.documentElement);
      this.StripeElementStyle.base.color = `rgb(${style.getPropertyValue("--color-text-main")})`;
      this.StripeElementStyle.base["::placeholder"].color = `rgb(${style.getPropertyValue(
        "--color-text-muted",
      )})`;
      this.StripeElementStyle.invalid.color = `rgb(${style.getPropertyValue("--color-text-main")})`;
      this.StripeElementStyle.invalid.borderColor = `rgb(${style.getPropertyValue(
        "--color-danger-600",
      )})`;
    });
  }
}
