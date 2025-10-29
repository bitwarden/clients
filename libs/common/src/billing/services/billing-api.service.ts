// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { PremiumPlanResponse } from "@bitwarden/common/billing/models/response/premium-plan.response";

import { ApiService } from "../../abstractions/api.service";
import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { ListResponse } from "../../models/response/list.response";
import { OrganizationId } from "../../types/guid";
import { BillingApiServiceAbstraction } from "../abstractions";
import { SubscriptionCancellationRequest } from "../models/request/subscription-cancellation.request";
import { InvoicesResponse } from "../models/response/invoices.response";
import { OrganizationBillingMetadataResponse } from "../models/response/organization-billing-metadata.response";
import { PlanResponse } from "../models/response/plan.response";
import { ProviderSubscriptionResponse } from "../models/response/provider-subscription-response";

export class BillingApiService implements BillingApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  cancelOrganizationSubscription(
    organizationId: string,
    request: SubscriptionCancellationRequest,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/cancel",
      request,
      true,
      false,
    );
  }

  cancelPremiumUserSubscription(request: SubscriptionCancellationRequest): Promise<void> {
    return this.apiService.send("POST", "/accounts/cancel", request, true, false);
  }

  async getOrganizationBillingMetadata(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/billing/metadata",
      null,
      true,
      true,
    );

    return new OrganizationBillingMetadataResponse(r);
  }

  async getOrganizationBillingMetadataVNext(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/billing/vnext/metadata",
      null,
      true,
      true,
    );

    return new OrganizationBillingMetadataResponse(r);
  }

  async getPlans(): Promise<ListResponse<PlanResponse>> {
    const r = await this.apiService.send("GET", "/plans", null, true, true);
    return new ListResponse(r, PlanResponse);
  }

  async getPremiumPlan(): Promise<PremiumPlanResponse> {
    const response = await this.apiService.send("GET", "/plans/premium", null, true, true);
    return new PremiumPlanResponse(response);
  }

  async getProviderClientInvoiceReport(providerId: string, invoiceId: string): Promise<string> {
    const response = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/billing/invoices/" + invoiceId,
      null,
      true,
      true,
    );
    return response as string;
  }

  async getProviderInvoices(providerId: string): Promise<InvoicesResponse> {
    const response = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/billing/invoices",
      null,
      true,
      true,
    );
    return new InvoicesResponse(response);
  }

  async getProviderSubscription(providerId: string): Promise<ProviderSubscriptionResponse> {
    const response = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/billing/subscription",
      null,
      true,
      true,
    );
    return new ProviderSubscriptionResponse(response);
  }

  async restartSubscription(
    organizationId: string,
    request: OrganizationCreateRequest,
  ): Promise<void> {
    return await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/billing/restart-subscription",
      request,
      true,
      false,
    );
  }
}
