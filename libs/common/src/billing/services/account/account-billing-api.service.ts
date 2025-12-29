import { ApiService } from "../../../abstractions/api.service";
import { StorageRequest } from "../../../models/request/storage.request";
import { AccountBillingApiServiceAbstraction } from "../../abstractions/account/account-billing-api.service.abstraction";
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "../../models/response/billing.response";

export class AccountBillingApiService implements AccountBillingApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async getBillingInvoices(
    status?: string,
    startAfter?: string,
  ): Promise<BillingInvoiceResponse[]> {
    const params = new URLSearchParams();

    if (status) {
      params.append("status", status);
    }

    if (startAfter) {
      params.append("startAfter", startAfter);
    }

    const queryString = `?${params.toString()}`;

    const r = await this.apiService.send(
      "GET",
      `/accounts/billing/invoices${queryString}`,
      null,
      true,
      true,
    );
    return r?.map((i: any) => new BillingInvoiceResponse(i)) || [];
  }

  async getBillingTransactions(startAfter?: string): Promise<BillingTransactionResponse[]> {
    const queryParams = startAfter ? `?startAfter=${startAfter}` : "";
    const r = await this.apiService.send(
      "GET",
      `/accounts/billing/transactions${queryParams}`,
      null,
      true,
      true,
    );
    return r?.map((i: any) => new BillingTransactionResponse(i)) || [];
  }

  async getUserLicense(): Promise<any> {
    return await this.apiService.send("GET", "/account/billing/vnext/license", null, true, true);
  }

  async putAccountStorage(request: StorageRequest): Promise<any> {
    return await this.apiService.send("PUT", "/account/billing/vnext/storage", request, true, true);
  }
}
