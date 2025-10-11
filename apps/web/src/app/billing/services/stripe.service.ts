// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BankAccount } from "@bitwarden/common/billing/models/domain";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BankAccountPaymentMethod, CardPaymentMethod } from "../payment/types";

import { BillingServicesModule } from "./billing-services.module";

type SetupBankAccountRequest = {
  payment_method: {
    us_bank_account: {
      routing_number: string;
      account_number: string;
      account_holder_type: string;
    };
    billing_details: {
      name: string;
      address?: {
        country: string;
        postal_code: string;
      };
    };
  };
};

type SetupCardRequest = {
  payment_method: {
    card: string;
    billing_details?: {
      address: {
        country: string;
        postal_code: string;
      };
    };
  };
};

@Injectable({ providedIn: BillingServicesModule })
export class StripeService {
  private stripe: any;
  private elements: any;
  private elementIds: {
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
  };

  constructor(
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  createSetupIntent = async (
    paymentMethod: BankAccountPaymentMethod | CardPaymentMethod,
  ): Promise<string> => {
    const getPath = () => {
      switch (paymentMethod) {
        case "bankAccount": {
          return "/setup-intent/bank-account";
        }
        case "card": {
          return "/setup-intent/card";
        }
      }
    };

    const response = await this.apiService.send("POST", getPath(), null, true, true);
    return response as string;
  };

  /**
   * Loads [Stripe JS]{@link https://docs.stripe.com/js} in the <head> element of the current page and mounts
   * Stripe credit card [elements]{@link https://docs.stripe.com/js/elements_object/create} into the HTML elements with the provided element IDS.
   * We do this to avoid having to load the Stripe JS SDK on every page of the Web Vault given many pages contain sensitive information.
   * @param elementIds - The ID attributes of the HTML elements used to load the Stripe JS credit card elements.
   * @param autoMount - A flag indicating whether you want to immediately mount the Stripe credit card elements.
   */
  loadStripe(
    elementIds: { cardNumber: string; cardExpiry: string; cardCvc: string },
    autoMount: boolean,
  ) {
    this.elementIds = elementIds;
    const script = window.document.createElement("script");
    script.id = "stripe-script";
    script.src = "https://js.stripe.com/v3?advancedFraudSignals=false";
    script.onload = async () => {
      const window$ = window as any;
      this.stripe = window$.Stripe(process.env.STRIPE_KEY);
      this.elements = this.stripe.elements();
      setTimeout(() => {
        this.elements.create("cardNumber", this.getElementOptions("cardNumber"));
        this.elements.create("cardExpiry", this.getElementOptions("cardExpiry"));
        this.elements.create("cardCvc", this.getElementOptions("cardCvc"));
        if (autoMount) {
          this.mountElements();
        }
      }, 50);
    };

    window.document.head.appendChild(script);
  }

  mountElements(attempt: number = 1) {
    setTimeout(() => {
      if (!this.elements) {
        this.logService.warning(`Stripe elements are missing, retrying for attempt ${attempt}...`);
        this.mountElements(attempt + 1);
      } else {
        const cardNumber = this.elements.getElement("cardNumber");
        const cardExpiry = this.elements.getElement("cardExpiry");
        const cardCVC = this.elements.getElement("cardCvc");

        if ([cardNumber, cardExpiry, cardCVC].some((element) => !element)) {
          this.logService.warning(
            `Some Stripe card elements are missing, retrying for attempt ${attempt}...`,
          );
          this.mountElements(attempt + 1);
        } else {
          cardNumber.mount(this.elementIds.cardNumber);
          cardExpiry.mount(this.elementIds.cardExpiry);
          cardCVC.mount(this.elementIds.cardCvc);
        }
      }
    }, 100);
  }

  /**
   * Creates a Stripe [SetupIntent]{@link https://docs.stripe.com/api/setup_intents} and uses the resulting client secret
   * to invoke the Stripe JS [confirmUsBankAccountSetup]{@link https://docs.stripe.com/js/setup_intents/confirm_us_bank_account_setup} method,
   * thereby creating and storing a Stripe [PaymentMethod]{@link https://docs.stripe.com/api/payment_methods}.
   * @returns The ID of the newly created PaymentMethod.
   */
  async setupBankAccountPaymentMethod(
    clientSecret: string,
    { accountHolderName, routingNumber, accountNumber, accountHolderType }: BankAccount,
    billingDetails?: { country: string; postalCode: string },
  ): Promise<string> {
    const request: SetupBankAccountRequest = {
      payment_method: {
        us_bank_account: {
          routing_number: routingNumber,
          account_number: accountNumber,
          account_holder_type: accountHolderType,
        },
        billing_details: {
          name: accountHolderName,
        },
      },
    };

    if (billingDetails) {
      request.payment_method.billing_details.address = {
        country: billingDetails.country,
        postal_code: billingDetails.postalCode,
      };
    }

    const result = await this.stripe.confirmUsBankAccountSetup(clientSecret, request);
    if (result.error || (result.setupIntent && result.setupIntent.status !== "requires_action")) {
      this.logService.error(result.error);
      throw result.error;
    }
    return result.setupIntent.payment_method as string;
  }

  /**
   * Creates a Stripe [SetupIntent]{@link https://docs.stripe.com/api/setup_intents} and uses the resulting client secret
   * to invoke the Stripe JS [confirmCardSetup]{@link https://docs.stripe.com/js/setup_intents/confirm_card_setup} method,
   * thereby creating and storing a Stripe [PaymentMethod]{@link https://docs.stripe.com/api/payment_methods}.
   * @returns The ID of the newly created PaymentMethod.
   */
  async setupCardPaymentMethod(
    clientSecret: string,
    billingDetails?: { country: string; postalCode: string },
  ): Promise<string> {
    const cardNumber = this.elements.getElement("cardNumber");
    const request: SetupCardRequest = {
      payment_method: {
        card: cardNumber,
      },
    };
    if (billingDetails) {
      request.payment_method.billing_details = {
        address: {
          country: billingDetails.country,
          postal_code: billingDetails.postalCode,
        },
      };
    }
    const result = await this.stripe.confirmCardSetup(clientSecret, request);
    if (result.error || (result.setupIntent && result.setupIntent.status !== "succeeded")) {
      this.logService.error(result.error);
      throw result.error;
    }
    return result.setupIntent.payment_method as string;
  }

  /**
   * Removes {@link https://docs.stripe.com/js} from the <head> element of the current page as well as all
   * Stripe-managed <iframe> elements.
   */
  unloadStripe() {
    const script = window.document.getElementById("stripe-script");
    window.document.head.removeChild(script);
    window.setTimeout(() => {
      const iFrames = Array.from(window.document.querySelectorAll("iframe")).filter(
        (element) => element.src != null && element.src.indexOf("stripe") > -1,
      );
      iFrames.forEach((iFrame) => {
        try {
          window.document.body.removeChild(iFrame);
        } catch (error) {
          this.logService.error(error);
        }
      });
    }, 500);
  }

  private getElementOptions(element: "cardNumber" | "cardExpiry" | "cardCvc"): any {
    const options: any = {
      style: {
        base: {
          color: null,
          fontFamily:
            'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif, ' +
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
      },
      classes: {
        base: "tw-stripe-form-control",
        focus: "is-focused",
        empty: "is-empty",
        invalid: "is-invalid",
      },
    };

    options.style.base.fontWeight = "500";

    // Remove the placeholder for number and CVC fields
    if (["cardNumber", "cardCvc"].includes(element)) {
      options.placeholder = "";
    }

    const style = getComputedStyle(document.documentElement);
    options.style.base.color = `rgb(${style.getPropertyValue("--color-text-main")})`;
    options.style.base["::placeholder"].color = `rgb(${style.getPropertyValue(
      "--color-text-muted",
    )})`;
    options.style.invalid.color = `rgb(${style.getPropertyValue("--color-text-main")})`;
    options.style.invalid.borderColor = `rgb(${style.getPropertyValue("--color-danger-600")})`;

    return options;
  }
}
