import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "../../admin-console/models/response/provider/provider-organization.response";
import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingMetadataResponse } from "../../billing/models/response/organization-billing-metadata.response";
import { PlanResponse } from "../../billing/models/response/plan.response";
import { ListResponse } from "../../models/response/list.response";
import { CreateClientOrganizationRequest } from "../models/request/create-client-organization.request";
import { UpdateClientOrganizationRequest } from "../models/request/update-client-organization.request";
import { InvoicesResponse } from "../models/response/invoices.response";
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

  abstract getOrganizationBillingMetadata(
    organizationId: string,
  ): Promise<OrganizationBillingMetadataResponse>;

  abstract getPlans(): Promise<ListResponse<PlanResponse>>;

  abstract getProviderClientInvoiceReport(providerId: string, invoiceId: string): Promise<string>;

  abstract getProviderClientOrganizations(
    providerId: string,
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>>;

  abstract getProviderInvoices(providerId: string): Promise<InvoicesResponse>;

  abstract getProviderSubscription(providerId: string): Promise<ProviderSubscriptionResponse>;

  abstract updateProviderClientOrganization(
    providerId: string,
    organizationId: string,
    request: UpdateClientOrganizationRequest,
  ): Promise<any>;

  abstract restartSubscription(
    organizationId: string,
    request: OrganizationCreateRequest,
  ): Promise<void>;
}
