import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "../../models/response/billing.response";

export abstract class AccountBillingApiServiceAbstraction {
  abstract getBillingInvoices(
    status?: string,
    startAfter?: string,
  ): Promise<BillingInvoiceResponse[]>;
  abstract getBillingTransactions(startAfter?: string): Promise<BillingTransactionResponse[]>;
}
