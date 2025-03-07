// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { BankAccount } from "@bitwarden/common/billing/models/domain";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BillingServicesModule } from "./billing-services.module";

@Injectable({ providedIn: BillingServicesModule })
export class StripeService {
  private stripe: any;
  private elements: any;
  private elementIds: {
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
  };

  constructor(private logService: LogService) {}

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

  /**
   * Re-mounts previously created Stripe credit card [elements]{@link https://docs.stripe.com/js/elements_object/create} into the HTML elements
   * specified during the {@link loadStripe} call. This is useful for when those HTML elements are removed from the DOM by Angular.
   */
  mountElements(i: number = 0) {
    setTimeout(() => {
      if (!document.querySelector(this.elementIds.cardNumber) && i < 10) {
        this.logService.warning("Stripe container missing, retrying...");
        this.mountElements(i + 1);
        return;
      }

      const cardNumber = this.elements.getElement("cardNumber");
      const cardExpiry = this.elements.getElement("cardExpiry");
      const cardCvc = this.elements.getElement("cardCvc");
      cardNumber.mount(this.elementIds.cardNumber);
      cardExpiry.mount(this.elementIds.cardExpiry);
      cardCvc.mount(this.elementIds.cardCvc);
    }, 50);
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
  ): Promise<string> {
    const result = await this.stripe.confirmUsBankAccountSetup(clientSecret, {
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
    });
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
  async setupCardPaymentMethod(clientSecret: string): Promise<string> {
    const cardNumber = this.elements.getElement("cardNumber");
    const result = await this.stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardNumber,
      },
    });
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
      },
      classes: {
        focus: "is-focused",
        empty: "is-empty",
        invalid: "is-invalid",
      },
    };

    options.style.base.fontWeight = "500";
    options.classes.base = "v2";

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
