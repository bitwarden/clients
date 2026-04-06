import { BaseResponse } from "../../../models/response/base.response";

import { BillingInvoiceResponse, BillingTransactionResponse } from "./billing.response";

export class BillingHistoryResponse extends BaseResponse {
  invoices: BillingInvoiceResponse[] = [];
  transactions: BillingTransactionResponse[] = [];

  constructor(response: any) {
    super(response);
    const transactions = this.getResponseProperty("Transactions");
    const invoices = this.getResponseProperty("Invoices");
    if (transactions != null) {
      this.transactions = transactions.map((t: any) => new BillingTransactionResponse(t));
    }
    if (invoices != null) {
      this.invoices = invoices.map((i: any) => new BillingInvoiceResponse(i));
    }
  }

  get hasNoHistory() {
    return this.invoices.length == 0 && this.transactions.length == 0;
  }
}
