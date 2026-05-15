import { CollectionLeasingRequest } from "../services/requests/collection-leasing.request";
import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "../services/requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { CollectionLeasingConfigResponse } from "./responses/collection-leasing.response";
import { OrganizationGovernanceSummaryResponse } from "./responses/governance-summary.response";
import { LeaseRequestResponse } from "./responses/lease-request.response";

export abstract class PamApiService {
  abstract fetchGatedCipher(id: string): Promise<GatedCipherFetchResult>;
  abstract patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse>;
  abstract cancelLeaseRequest(id: string): Promise<void>;
  abstract requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse>;
  abstract decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse>;
  abstract revokeLease(id: string, request: LeaseRevokeRequest): Promise<void>;
  abstract setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse>;
  /**
   * Fetch the leasing governance summary for an organization — org-wide totals
   * and a row per leasing-enabled collection. Org-admin only on the server.
   * See PM-37277.
   */
  abstract getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse>;
}
