import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingMetadataResponse } from "../../billing/models/response/organization-billing-metadata.response";
import { PlanResponse } from "../../billing/models/response/plan.response";
import { ListResponse } from "../../models/response/list.response";
import { OrganizationId } from "../../types/guid";
import { InvoicesResponse } from "../models/response/invoices.response";
import { ProviderSubscriptionResponse } from "../models/response/provider-subscription-response";

export abstract class BillingApiServiceAbstraction {
  abstract cancelOrganizationSubscription(
    organizationId: string,
    request: SubscriptionCancellationRequest,
  ): Promise<void>;

  abstract cancelPremiumUserSubscription(request: SubscriptionCancellationRequest): Promise<void>;

  abstract getOrganizationBillingMetadata(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse>;

  abstract getOrganizationBillingMetadataVNext(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse>;

  abstract getPlans(): Promise<ListResponse<PlanResponse>>;

  abstract getProviderClientInvoiceReport(providerId: string, invoiceId: string): Promise<string>;

  abstract getProviderInvoices(providerId: string): Promise<InvoicesResponse>;

  abstract getProviderSubscription(providerId: string): Promise<ProviderSubscriptionResponse>;

  abstract restartSubscription(
    organizationId: string,
    request: OrganizationCreateRequest,
  ): Promise<void>;
}
