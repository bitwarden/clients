import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { TaxIdWarningResponse } from "@bitwarden/web-vault/app/billing/warnings/types";

type ProviderSuspensionResolution =
  | "add_payment_method"
  | "contact_administrator"
  | "contact_support";

export class ProviderWarningsResponse extends BaseResponse {
  suspension?: SuspensionWarningResponse;
  taxId?: TaxIdWarningResponse;

  constructor(response: any) {
    super(response);
    const suspension = this.getResponseProperty("Suspension");
    if (suspension) {
      this.suspension = new SuspensionWarningResponse(suspension);
    }
    const taxId = this.getResponseProperty("TaxId");
    if (taxId) {
      this.taxId = new TaxIdWarningResponse(taxId);
    }
  }
}

class SuspensionWarningResponse extends BaseResponse {
  resolution: ProviderSuspensionResolution;
  subscriptionCancelsAt?: Date;

  constructor(response: any) {
    super(response);

    this.resolution = this.getResponseProperty("Resolution");
    const subscriptionCancelsAt = this.getResponseProperty("SubscriptionCancelsAt");
    if (subscriptionCancelsAt) {
      this.subscriptionCancelsAt = new Date(subscriptionCancelsAt);
    }
  }
}
