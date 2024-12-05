// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { UpdatePaymentMethodRequest } from "@bitwarden/common/billing/models/request/update-payment-method.request";
import { VerifyBankAccountRequest } from "@bitwarden/common/billing/models/request/verify-bank-account.request";
import { InvoicesResponse } from "@bitwarden/common/billing/models/response/invoices.response";
import { PaymentMethodResponse } from "@bitwarden/common/billing/models/response/payment-method.response";

import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingMetadataResponse } from "../../billing/models/response/organization-billing-metadata.response";
import { PlanResponse } from "../../billing/models/response/plan.response";
import { ListResponse } from "../../models/response/list.response";
import { CreateClientOrganizationRequest } from "../models/request/create-client-organization.request";
import { UpdateClientOrganizationRequest } from "../models/request/update-client-organization.request";
import { ProviderSubscriptionResponse } from "../models/response/provider-subscription-response";

export abstract class BillingApiServiceAbstraction {
  cancelOrganizationSubscription: (
    organizationId: string,
    request: SubscriptionCancellationRequest,
  ) => Promise<void>;

  cancelPremiumUserSubscription: (request: SubscriptionCancellationRequest) => Promise<void>;

  createProviderClientOrganization: (
    providerId: string,
    request: CreateClientOrganizationRequest,
  ) => Promise<void>;

  createSetupIntent: (paymentMethodType: PaymentMethodType) => Promise<string>;

  getOrganizationBillingMetadata: (
    organizationId: string,
  ) => Promise<OrganizationBillingMetadataResponse>;

  getOrganizationPaymentMethod: (organizationId: string) => Promise<PaymentMethodResponse>;

  getPlans: () => Promise<ListResponse<PlanResponse>>;

  getProviderClientInvoiceReport: (providerId: string, invoiceId: string) => Promise<string>;

  getProviderClientOrganizations: (
    providerId: string,
  ) => Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>>;

  getProviderInvoices: (providerId: string) => Promise<InvoicesResponse>;

  getProviderSubscription: (providerId: string) => Promise<ProviderSubscriptionResponse>;

  updateOrganizationPaymentMethod: (
    organizationId: string,
    request: UpdatePaymentMethodRequest,
  ) => Promise<void>;

  updateOrganizationTaxInformation: (
    organizationId: string,
    request: ExpandedTaxInfoUpdateRequest,
  ) => Promise<void>;

  updateProviderClientOrganization: (
    providerId: string,
    organizationId: string,
    request: UpdateClientOrganizationRequest,
  ) => Promise<any>;

  updateProviderTaxInformation: (
    providerId: string,
    request: ExpandedTaxInfoUpdateRequest,
  ) => Promise<void>;

  verifyOrganizationBankAccount: (
    organizationId: string,
    request: VerifyBankAccountRequest,
  ) => Promise<void>;
}
