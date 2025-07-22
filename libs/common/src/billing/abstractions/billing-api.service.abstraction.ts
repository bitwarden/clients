import { TaxInfoResponse } from "@bitwarden/common/billing/models/response/tax-info.response";

import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "../../admin-console/models/response/provider/provider-organization.response";
import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingMetadataResponse } from "../../billing/models/response/organization-billing-metadata.response";
import { PlanResponse } from "../../billing/models/response/plan.response";
import { ListResponse } from "../../models/response/list.response";
import { PaymentMethodType } from "../enums";
import { CreateClientOrganizationRequest } from "../models/request/create-client-organization.request";
import { ExpandedTaxInfoUpdateRequest } from "../models/request/expanded-tax-info-update.request";
import { UpdateClientOrganizationRequest } from "../models/request/update-client-organization.request";
import { UpdatePaymentMethodRequest } from "../models/request/update-payment-method.request";
import { VerifyBankAccountRequest } from "../models/request/verify-bank-account.request";
import { InvoicesResponse } from "../models/response/invoices.response";
import { PaymentMethodResponse } from "../models/response/payment-method.response";
import { ProviderSubscriptionResponse } from "../models/response/provider-subscription-response";

export abstract class BillingApiServiceAbstraction {
  abstract cancelOrganizationSubscription(
    organizationId: string,
    request: SubscriptionCancellationRequest,
  ): Promise<void>;

  abstract cancelPremiumUserSubscription(request: SubscriptionCancellationRequest): Promise<void>;

  abstract createProviderClientOrganization(
    providerId: string,
    request: CreateClientOrganizationRequest,
  ): Promise<void>;

  abstract createSetupIntent(paymentMethodType: PaymentMethodType): Promise<string>;

  abstract getOrganizationBillingMetadata(
    organizationId: string,
  ): Promise<OrganizationBillingMetadataResponse>;

  abstract getOrganizationPaymentMethod(organizationId: string): Promise<PaymentMethodResponse>;

  abstract getPlans(): Promise<ListResponse<PlanResponse>>;

  abstract getProviderClientInvoiceReport(providerId: string, invoiceId: string): Promise<string>;

  abstract getProviderClientOrganizations(
    providerId: string,
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>>;

  abstract getProviderInvoices(providerId: string): Promise<InvoicesResponse>;

  abstract getProviderSubscription(providerId: string): Promise<ProviderSubscriptionResponse>;

  abstract getProviderTaxInformation(providerId: string): Promise<TaxInfoResponse>;

  abstract updateOrganizationPaymentMethod(
    organizationId: string,
    request: UpdatePaymentMethodRequest,
  ): Promise<void>;

  abstract updateOrganizationTaxInformation(
    organizationId: string,
    request: ExpandedTaxInfoUpdateRequest,
  ): Promise<void>;

  abstract updateProviderClientOrganization(
    providerId: string,
    organizationId: string,
    request: UpdateClientOrganizationRequest,
  ): Promise<any>;

  abstract updateProviderPaymentMethod(
    providerId: string,
    request: UpdatePaymentMethodRequest,
  ): Promise<void>;

  abstract updateProviderTaxInformation(
    providerId: string,
    request: ExpandedTaxInfoUpdateRequest,
  ): Promise<void>;

  abstract verifyOrganizationBankAccount(
    organizationId: string,
    request: VerifyBankAccountRequest,
  ): Promise<void>;

  abstract verifyProviderBankAccount(
    providerId: string,
    request: VerifyBankAccountRequest,
  ): Promise<void>;

  abstract restartSubscription(
    organizationId: string,
    request: OrganizationCreateRequest,
  ): Promise<void>;
}
