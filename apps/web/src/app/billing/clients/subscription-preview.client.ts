import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SubscriptionPreviewResponse } from "@bitwarden/common/billing/models/response/subscription-preview.response";

/**
 * Raw HTTP access to the subscription preview endpoints. No adaptation and no flow context —
 * callers go through `SubscriptionPreviewService`, which owns both.
 *
 * Both routes are gated server-side by the `PM36631_PreviewDrivenCart` flag and return 404 until
 * the corresponding server ticket lands. 404s deliberately propagate.
 */
@Injectable({ providedIn: "root" })
export class SubscriptionPreviewClient {
  private apiService = inject(ApiService);

  /** Consumed by PM-40226. */
  getAccountSubscriptionPreview = async (): Promise<SubscriptionPreviewResponse> => {
    const json = await this.apiService.send(
      "GET",
      "/account/billing/subscription/preview",
      null,
      true,
      true,
    );

    return new SubscriptionPreviewResponse(json);
  };

  /** Consumed by PM-39927. */
  getOrganizationSubscriptionPreview = async (
    organizationId: string,
  ): Promise<SubscriptionPreviewResponse> => {
    const json = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/billing/subscription/preview`,
      null,
      true,
      true,
    );

    return new SubscriptionPreviewResponse(json);
  };
}
