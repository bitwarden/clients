import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import {
  BillingAddress,
  BillingAddressResponse,
  MaskedPaymentMethod,
  MaskedPaymentMethodResponse,
  TokenizedPaymentMethod,
} from "../payment/types";
import { BitwardenSubscriber } from "../types";

type Result<T> =
  | {
      type: "success";
      value: T;
    }
  | {
      type: "error";
      message: string;
    };

@Injectable()
export class SubscriberBillingClient {
  constructor(private apiService: ApiService) {}

  private getEndpoint = (subscriber: BitwardenSubscriber): string => {
    switch (subscriber.type) {
      case "account": {
        return "/account/billing/vnext";
      }
      case "organization": {
        return `/organizations/${subscriber.data.id}/billing/vnext`;
      }
      case "provider": {
        return `/providers/${subscriber.data.id}/billing/vnext`;
      }
    }
  };

  addCreditWithBitPay = async (
    subscriber: BitwardenSubscriber,
    credit: { amount: number; redirectUrl: string },
  ): Promise<Result<string>> => {
    const path = `${this.getEndpoint(subscriber)}/credit/bitpay`;
    try {
      const data = await this.apiService.send("POST", path, credit, true, true);
      return {
        type: "success",
        value: data as string,
      };
    } catch (error: any) {
      if (error instanceof ErrorResponse) {
        return {
          type: "error",
          message: error.message,
        };
      }
      throw error;
    }
  };

  getBillingAddress = async (subscriber: BitwardenSubscriber): Promise<BillingAddress | null> => {
    const path = `${this.getEndpoint(subscriber)}/address`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? new BillingAddressResponse(data) : null;
  };

  getCredit = async (subscriber: BitwardenSubscriber): Promise<number | null> => {
    const path = `${this.getEndpoint(subscriber)}/credit`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? (data as number) : null;
  };

  getPaymentMethod = async (
    subscriber: BitwardenSubscriber,
  ): Promise<MaskedPaymentMethod | null> => {
    const path = `${this.getEndpoint(subscriber)}/payment-method`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? new MaskedPaymentMethodResponse(data).value : null;
  };

  restartSubscription = async (
    subscriber: BitwardenSubscriber,
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: BillingAddress,
  ): Promise<void> => {
    const path = `${this.getEndpoint(subscriber)}/subscription/restart`;
    await this.apiService.send(
      "POST",
      path,
      {
        paymentMethod,
        billingAddress,
      },
      true,
      false,
    );
  };

  updateBillingAddress = async (
    subscriber: BitwardenSubscriber,
    billingAddress: BillingAddress,
  ): Promise<Result<BillingAddress>> => {
    const path = `${this.getEndpoint(subscriber)}/address`;
    try {
      const data = await this.apiService.send("PUT", path, billingAddress, true, true);
      return {
        type: "success",
        value: new BillingAddressResponse(data),
      };
    } catch (error: any) {
      if (error instanceof ErrorResponse) {
        return {
          type: "error",
          message: error.message,
        };
      }
      throw error;
    }
  };

  updatePaymentMethod = async (
    subscriber: BitwardenSubscriber,
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode"> | null,
  ): Promise<Result<MaskedPaymentMethod>> => {
    const path = `${this.getEndpoint(subscriber)}/payment-method`;
    try {
      const request = {
        ...paymentMethod,
        billingAddress,
      };
      const data = await this.apiService.send("PUT", path, request, true, true);
      return {
        type: "success",
        value: new MaskedPaymentMethodResponse(data).value,
      };
    } catch (error: any) {
      if (error instanceof ErrorResponse) {
        return {
          type: "error",
          message: error.message,
        };
      }
      throw error;
    }
  };

  verifyBankAccount = async (
    subscriber: BitwardenSubscriber,
    descriptorCode: string,
  ): Promise<Result<MaskedPaymentMethod>> => {
    const path = `${this.getEndpoint(subscriber)}/payment-method/verify-bank-account`;
    try {
      const data = await this.apiService.send("POST", path, { descriptorCode }, true, true);
      return {
        type: "success",
        value: new MaskedPaymentMethodResponse(data).value,
      };
    } catch (error: any) {
      if (error instanceof ErrorResponse) {
        return {
          type: "error",
          message: error.message,
        };
      }
      throw error;
    }
  };
}
