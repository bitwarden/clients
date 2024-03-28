import { ApiService } from "../../abstractions/api.service";
import { BillingApiServiceAbstraction } from "../../billing/abstractions/billilng-api.service.abstraction";
import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingStatusResponse } from "../../billing/models/response/organization-billing-status.response";
import { ProviderSubscriptionUpdateRequest } from "../models/request/provider-subscription-update.request";
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

  async getBillingStatus(id: string): Promise<OrganizationBillingStatusResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + id + "/billing-status",
      null,
      true,
      true,
    );

    return new OrganizationBillingStatusResponse(r);
  }

  async getProviderClientSubscriptions(providerId: string): Promise<ProviderSubscriptionResponse> {
    const r = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/billing/subscription",
      null,
      true,
      true,
    );
    return new ProviderSubscriptionResponse(r);
  }

  async putProviderClientSubscriptions(
    providerId: string,
    organizationId: string,
    request: ProviderSubscriptionUpdateRequest,
  ): Promise<any> {
    const response = await this.apiService.send(
      "PUT",
      "/providers/" + providerId + "/organizations/" + organizationId,
      request,
      true,
      true,
    );
    return new response();
  }
}
