// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "../../models/response/billing.response";

export class AccountBillingApiServiceAbstraction {
  getBillingInvoices: (status?: string, startAfter?: string) => Promise<BillingInvoiceResponse[]>;
  getBillingTransactions: (startAfter?: string) => Promise<BillingTransactionResponse[]>;
}
