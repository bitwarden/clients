import { ChangePlanFrequencyRequest } from "@bitwarden/common/billing/models/request/change-plan-frequency.request";

import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "../../models/response/billing.response";

export abstract class OrganizationBillingApiServiceAbstraction {
  abstract getBillingInvoices: (
    id: string,
    status?: string,
    startAfter?: string,
  ) => Promise<BillingInvoiceResponse[]>;

  abstract getBillingTransactions: (
    id: string,
    startAfter?: string,
  ) => Promise<BillingTransactionResponse[]>;

  abstract setupBusinessUnit: (
    id: string,
    request: {
      userId: string;
      token: string;
      providerKey: string;
      organizationKey: string;
    },
  ) => Promise<string>;

  abstract changeSubscriptionFrequency: (
    organizationId: string,
    request: ChangePlanFrequencyRequest,
  ) => Promise<void>;
}
