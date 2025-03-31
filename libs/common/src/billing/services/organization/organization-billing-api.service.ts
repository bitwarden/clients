import { ApiService } from "../../../abstractions/api.service";
import { OrganizationBillingApiServiceAbstraction } from "../../abstractions/organizations/organization-billing-api.service.abstraction";
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "../../models/response/billing.response";

export class OrganizationBillingApiService implements OrganizationBillingApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async getBillingInvoices(
    id: string,
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
      `/organizations/${id}/billing/invoices${queryString}`,
      null,
      true,
      true,
    );
    return r?.map((i: any) => new BillingInvoiceResponse(i)) || [];
  }

  async getBillingTransactions(
    id: string,
    startAfter?: string,
  ): Promise<BillingTransactionResponse[]> {
    const queryParams = startAfter ? `?startAfter=${startAfter}` : "";
    const r = await this.apiService.send(
      "GET",
      `/organizations/${id}/billing/transactions${queryParams}`,
      null,
      true,
      true,
    );
    return r?.map((i: any) => new BillingTransactionResponse(i)) || [];
  }
}
