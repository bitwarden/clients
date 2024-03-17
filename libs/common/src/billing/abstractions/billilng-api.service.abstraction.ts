import { SubscriptionCancellationRequest } from "../../billing/models/request/subscription-cancellation.request";
import { OrganizationBillingStatusResponse } from "../../billing/models/response/organization-billing-status.response";

export abstract class BillingApiServiceAbstraction {
  cancelOrganizationSubscription: (
    organizationId: string,
    request: SubscriptionCancellationRequest,
  ) => Promise<void>;
  cancelPremiumUserSubscription: (request: SubscriptionCancellationRequest) => Promise<void>;
  getBillingStatus: (id: string) => Promise<OrganizationBillingStatusResponse>;
}
