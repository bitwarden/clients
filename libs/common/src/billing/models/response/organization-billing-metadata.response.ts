import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationBillingMetadataResponse extends BaseResponse {
  isEligibleForSelfHost: boolean;
  isManaged: boolean;
  isOnSecretsManagerStandalone: boolean;
  isSubscriptionUnpaid: boolean;
  hasSubscription: boolean;
  isSubscriptionCanceled: boolean;

  constructor(response: any) {
    super(response);
    this.isEligibleForSelfHost = this.getResponseProperty("IsEligibleForSelfHost");
    this.isManaged = this.getResponseProperty("IsManaged");
    this.isOnSecretsManagerStandalone = this.getResponseProperty("IsOnSecretsManagerStandalone");
    this.isSubscriptionUnpaid = this.getResponseProperty("IsSubscriptionUnpaid");
    this.hasSubscription = this.getResponseProperty("HasSubscription");
    this.isSubscriptionCanceled = this.getResponseProperty("IsSubscriptionCanceled");
  }
}
