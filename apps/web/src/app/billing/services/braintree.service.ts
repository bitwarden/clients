// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BillingServicesModule } from "./billing-services.module";

@Injectable({ providedIn: BillingServicesModule })
export class BraintreeService {
  private braintree: any;
  private containerId: string;

  constructor(private logService: LogService) {}

  /**
   * Utilizes the Braintree SDK to create a [Braintree drop-in]{@link https://braintree.github.io/braintree-web-drop-in/docs/current/Dropin.html} instance attached to the container ID specified as part of the {@link loadBraintree} method.
   */
  createDropin() {
    window.setTimeout(() => {
      const window$ = window as any;
      window$.braintree.dropin.create(
        {
          authorization: process.env.BRAINTREE_KEY,
          container: this.containerId,
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
        (error: any, instance: any) => {
          if (error != null) {
            this.logService.error(error);
            return;
          }
          this.braintree = instance;
        },
      );
    }, 250);
  }

  /**
   * Loads the Bitwarden dropin.js script in the <head> element of the current page.
   * This script attaches the Braintree SDK to the window.
   * @param containerId - The ID of the HTML element where the Braintree drop-in will be loaded at.
   * @param autoCreateDropin - Specifies whether the Braintree drop-in should be created when dropin.js loads.
   */
  loadBraintree(containerId: string, autoCreateDropin: boolean) {
    const script = window.document.createElement("script");
    script.id = "dropin-script";
    script.src = `scripts/dropin.js?cache=${process.env.CACHE_TAG}`;
    script.async = true;
    if (autoCreateDropin) {
      script.onload = () => this.createDropin();
    }
    this.containerId = containerId;
    window.document.head.appendChild(script);
  }

  /**
   * Invokes the Braintree [requestPaymentMethod]{@link https://braintree.github.io/braintree-web-drop-in/docs/current/Dropin.html#requestPaymentMethod} method
   * in order to generate a payment method token using the active Braintree drop-in.
   */
  requestPaymentMethod(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.braintree.requestPaymentMethod((error: any, payload: any) => {
        if (error) {
          this.logService.error(error);
          reject(error.message);
        } else {
          resolve(payload.nonce as string);
        }
      });
    });
  }

  /**
   * Removes the following elements from the <head> of the current page:
   * - The Bitwarden dropin.js script
   * - Any <script> elements that contain the word "paypal"
   * - The Braintree drop-in stylesheet
   */
  unloadBraintree() {
    const script = window.document.getElementById("dropin-script");
    window.document.head.removeChild(script);
    window.setTimeout(() => {
      const scripts = Array.from(window.document.head.querySelectorAll("script")).filter(
        (script) => script.src != null && script.src.indexOf("paypal") > -1,
      );
      scripts.forEach((script) => {
        try {
          window.document.head.removeChild(script);
        } catch (error) {
          this.logService.error(error);
        }
      });
      const stylesheet = window.document.head.querySelector("#braintree-dropin-stylesheet");
      if (stylesheet != null) {
        try {
          window.document.head.removeChild(stylesheet);
        } catch (error) {
          this.logService.error(error);
        }
      }
    }, 500);
  }
}
