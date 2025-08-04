import { ChangePlanFrequencyRequest } from "@bitwarden/common/billing/models/request/change-plan-frequency.request";
import { OrganizationWarningsResponse } from "@bitwarden/common/billing/models/response/organization-warnings.response";

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

  abstract getWarnings: (id: string) => Promise<OrganizationWarningsResponse>;

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
