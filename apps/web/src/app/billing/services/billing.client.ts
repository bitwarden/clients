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
import { BillableEntity } from "../types";

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
export class BillingClient {
  constructor(private apiService: ApiService) {}

  private getEndpoint = (entity: BillableEntity): string => {
    switch (entity.type) {
      case "account": {
        return "/account/billing/vnext";
      }
      case "organization": {
        return `/organizations/${entity.data.id}/billing/vnext`;
      }
      case "provider": {
        return `/providers/${entity.data.id}/billing/vnext`;
      }
    }
  };

  addCreditWithBitPay = async (
    owner: BillableEntity,
    credit: { amount: number; redirectUrl: string },
  ): Promise<Result<string>> => {
    const path = `${this.getEndpoint(owner)}/credit/bitpay`;
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

  getBillingAddress = async (owner: BillableEntity): Promise<BillingAddress | null> => {
    const path = `${this.getEndpoint(owner)}/address`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? new BillingAddressResponse(data) : null;
  };

  getCredit = async (owner: BillableEntity): Promise<number | null> => {
    const path = `${this.getEndpoint(owner)}/credit`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? (data as number) : null;
  };

  getPaymentMethod = async (owner: BillableEntity): Promise<MaskedPaymentMethod | null> => {
    const path = `${this.getEndpoint(owner)}/payment-method`;
    const data = await this.apiService.send("GET", path, null, true, true);
    return data ? new MaskedPaymentMethodResponse(data).value : null;
  };

  updateBillingAddress = async (
    owner: BillableEntity,
    billingAddress: BillingAddress,
  ): Promise<Result<BillingAddress>> => {
    const path = `${this.getEndpoint(owner)}/address`;
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
    owner: BillableEntity,
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode"> | null,
  ): Promise<Result<MaskedPaymentMethod>> => {
    const path = `${this.getEndpoint(owner)}/payment-method`;
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
    owner: BillableEntity,
    descriptorCode: string,
  ): Promise<Result<MaskedPaymentMethod>> => {
    const path = `${this.getEndpoint(owner)}/payment-method/verify-bank-account`;
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
