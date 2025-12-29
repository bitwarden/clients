import { StorageRequest } from "../../../models/request/storage.request";
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
  abstract getUserLicense(): Promise<any>;
  abstract putAccountStorage(request: StorageRequest): Promise<any>;
}
