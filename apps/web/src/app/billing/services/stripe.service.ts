// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BankAccount } from "@bitwarden/common/billing/models/domain";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BankAccountPaymentMethod, CardPaymentMethod } from "../payment/types";

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

@Injectable({ providedIn: "root" })
export class StripeService {
  // Shared/Global - One Stripe client for entire application
  private stripe: any = null;
  private stripeScriptLoaded = false;
  private instanceCount = 0;

  // Per-Instance - Isolated Elements for each component
  private instances = new Map<
    string,
    {
      elements: any;
      elementIds: { cardNumber: string; cardExpiry: string; cardCvc: string };
    }
  >();

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
   * @param instanceId - Unique identifier for this component instance.
   * @param elementIds - The ID attributes of the HTML elements used to load the Stripe JS credit card elements.
   * @param autoMount - A flag indicating whether you want to immediately mount the Stripe credit card elements.
   */
  loadStripe(
    instanceId: string,
    elementIds: { cardNumber: string; cardExpiry: string; cardCvc: string },
    autoMount: boolean,
  ) {
    // Check if script is already loaded
    if (this.stripeScriptLoaded) {
      // Script already loaded, initialize this instance immediately
      this.initializeInstance(instanceId, elementIds, autoMount);
    } else if (!window.document.getElementById("stripe-script")) {
      // Script not loaded and not loading, start loading it
      const script = window.document.createElement("script");
      script.id = "stripe-script";
      script.src = "https://js.stripe.com/v3?advancedFraudSignals=false";
      script.onload = async () => {
        const window$ = window as any;
        this.stripe = window$.Stripe(process.env.STRIPE_KEY);
        this.stripeScriptLoaded = true; // Mark as loaded after script loads

        // Initialize this instance after script loads
        this.initializeInstance(instanceId, elementIds, autoMount);
      };
      window.document.head.appendChild(script);
    } else {
      // Script is currently loading, wait for it
      this.initializeInstance(instanceId, elementIds, autoMount);
    }
  }

  private initializeInstance(
    instanceId: string,
    elementIds: { cardNumber: string; cardExpiry: string; cardCvc: string },
    autoMount: boolean,
  ) {
    // Wait for stripe to be available if script just loaded
    if (!this.stripe) {
      setTimeout(() => this.initializeInstance(instanceId, elementIds, autoMount), 50);
      return;
    }

    // Create a new Elements instance for this component
    const elements = this.stripe.elements();

    // Store instance data
    this.instances.set(instanceId, { elements, elementIds });

    // Increment instance count now that instance is successfully initialized
    this.instanceCount++;

    // Create the card elements
    setTimeout(() => {
      elements.create("cardNumber", this.getElementOptions("cardNumber"));
      elements.create("cardExpiry", this.getElementOptions("cardExpiry"));
      elements.create("cardCvc", this.getElementOptions("cardCvc"));

      if (autoMount) {
        this.mountElements(instanceId);
      }
    }, 50);
  }

  mountElements(instanceId: string, attempt: number = 1) {
    setTimeout(() => {
      const instance = this.instances.get(instanceId);

      if (!instance) {
        if (attempt < 10) {
          this.logService.warning(
            `Stripe instance ${instanceId} not found, retrying for attempt ${attempt}...`,
          );
          this.mountElements(instanceId, attempt + 1);
        } else {
          this.logService.error(
            `Stripe instance ${instanceId} not found after ${attempt} attempts`,
          );
        }
        return;
      }

      if (!instance.elements) {
        this.logService.warning(
          `Stripe elements for instance ${instanceId} are missing, retrying for attempt ${attempt}...`,
        );
        this.mountElements(instanceId, attempt + 1);
      } else {
        const cardNumber = instance.elements.getElement("cardNumber");
        const cardExpiry = instance.elements.getElement("cardExpiry");
        const cardCVC = instance.elements.getElement("cardCvc");

        if ([cardNumber, cardExpiry, cardCVC].some((element) => !element)) {
          this.logService.warning(
            `Some Stripe card elements for instance ${instanceId} are missing, retrying for attempt ${attempt}...`,
          );
          this.mountElements(instanceId, attempt + 1);
        } else {
          cardNumber.mount(instance.elementIds.cardNumber);
          cardExpiry.mount(instance.elementIds.cardExpiry);
          cardCVC.mount(instance.elementIds.cardCvc);
        }
      }
    }, 100);
  }

  /**
   * Creates a Stripe [SetupIntent]{@link https://docs.stripe.com/api/setup_intents} and uses the resulting client secret
   * to invoke the Stripe JS [confirmUsBankAccountSetup]{@link https://docs.stripe.com/js/setup_intents/confirm_us_bank_account_setup} method,
   * thereby creating and storing a Stripe [PaymentMethod]{@link https://docs.stripe.com/api/payment_methods}.
   * @param clientSecret - The client secret from the SetupIntent.
   * @param bankAccount - The bank account details.
   * @param billingDetails - Optional billing details.
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
   * @param instanceId - Unique identifier for the component instance.
   * @param clientSecret - The client secret from the SetupIntent.
   * @param billingDetails - Optional billing details.
   * @returns The ID of the newly created PaymentMethod.
   */
  async setupCardPaymentMethod(
    instanceId: string,
    clientSecret: string,
    billingDetails?: { country: string; postalCode: string },
  ): Promise<string> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Stripe instance ${instanceId} not found`);
    }

    const cardNumber = instance.elements.getElement("cardNumber");
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
   * Removes the Stripe Elements instance for the specified component.
   * Only removes the Stripe script and iframes when the last instance is unloaded.
   * @param instanceId - Unique identifier for the component instance to unload.
   */
  unloadStripe(instanceId: string) {
    const instance = this.instances.get(instanceId);

    // Only proceed if instance was actually initialized
    if (!instance) {
      return;
    }

    // Unmount all elements for this instance
    if (instance.elements) {
      try {
        const cardNumber = instance.elements.getElement("cardNumber");
        const cardExpiry = instance.elements.getElement("cardExpiry");
        const cardCvc = instance.elements.getElement("cardCvc");

        if (cardNumber) {cardNumber.unmount();}
        if (cardExpiry) {cardExpiry.unmount();}
        if (cardCvc) {cardCvc.unmount();}
      } catch (error) {
        this.logService.error(
          `Error unmounting Stripe elements for instance ${instanceId}:`,
          error,
        );
      }
    }

    // Remove instance from map
    this.instances.delete(instanceId);

    // Decrement instance count (only if instance was initialized)
    this.instanceCount--;

    // Only remove script and iframes when no instances remain
    if (this.instanceCount <= 0) {
      this.instanceCount = 0;
      this.stripeScriptLoaded = false;
      this.stripe = null;

      const script = window.document.getElementById("stripe-script");
      if (script) {
        window.document.head.removeChild(script);
      }

      window.setTimeout(() => {
        const iFrames = Array.from(window.document.querySelectorAll("iframe")).filter(
          (element) => element.src != null && element.src.indexOf("stripe") > -1,
        );
        iFrames.forEach((iFrame) => {
          try {
            iFrame.remove();
          } catch (error) {
            this.logService.error(error);
          }
        });
      }, 500);
    }
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
          lineHeight: "1.5",
          padding: "8px 12px",
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
