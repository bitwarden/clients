import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { AccessRuleRequest } from "../services/requests/access-rule.request";
import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "../services/requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { AccessRuleResponse } from "./responses/access-rule.response";
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

  abstract listAccessRules(organizationId: string): Promise<ListResponse<AccessRuleResponse>>;
  abstract getAccessRule(organizationId: string, id: string): Promise<AccessRuleResponse>;
  abstract createAccessRule(
    organizationId: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse>;
  abstract updateAccessRule(
    organizationId: string,
    id: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse>;
  abstract deleteAccessRule(organizationId: string, id: string): Promise<void>;
}
