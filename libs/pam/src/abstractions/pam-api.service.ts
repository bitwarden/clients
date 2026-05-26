import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "../services/requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";
import { LeasingPolicyRequest } from "../services/requests/leasing-policy.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { LeaseRequestResponse } from "./responses/lease-request.response";
import { LeasingPolicyResponse } from "./responses/leasing-policy.response";

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

  abstract listLeasingPolicies(
    organizationId: string,
  ): Promise<ListResponse<LeasingPolicyResponse>>;
  abstract getLeasingPolicy(organizationId: string, id: string): Promise<LeasingPolicyResponse>;
  abstract createLeasingPolicy(
    organizationId: string,
    request: LeasingPolicyRequest,
  ): Promise<LeasingPolicyResponse>;
  abstract updateLeasingPolicy(
    organizationId: string,
    id: string,
    request: LeasingPolicyRequest,
  ): Promise<LeasingPolicyResponse>;
  abstract deleteLeasingPolicy(organizationId: string, id: string): Promise<void>;
}
