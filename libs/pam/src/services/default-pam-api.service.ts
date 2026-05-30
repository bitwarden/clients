import { Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { GatedCipherFetchResult } from "../abstractions/gated-cipher-fetch-result";
import { CipherAccessState, PamApiService } from "../abstractions/pam-api.service";
import { AccessRuleResponse } from "../abstractions/responses/access-rule.response";
import { AccessRequestResponse } from "../abstractions/responses/access-request.response";
import { BulkRevokeResult } from "../abstractions/responses/bulk-revoke.result";
import { OrganizationGovernanceSummaryResponse } from "../abstractions/responses/governance-summary.response";
import { InboxAccessRequestResponse } from "../abstractions/responses/inbox-access-request.response";
import { InboxBadgeCountResponse } from "../abstractions/responses/inbox-badge-count.response";
import { LeaseResponse } from "../abstractions/responses/lease.response";

import { AccessRuleRequest } from "./requests/access-rule.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { AccessRequestPatchRequest } from "./requests/access-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class DefaultPamApiService implements PamApiService {
  constructor(private apiService: ApiService) {}

  // TODO(PM-37264): implement the cipher-fetch transport. ApiService.send is
  // unsuitable here because it rejects every non-200 via ErrorResponse (dropping
  // the response body — so a 202 carrying a AccessRequest can't be reconstructed)
  // and calls logoutCallback("invalidAccessToken") on any authenticated 403,
  // which would log the user out on every "denied" verdict.
  fetchGatedCipher(_id: string): Promise<GatedCipherFetchResult> {
    return Promise.reject(new Error("fetchGatedCipher is not implemented yet; see PM-37264"));
  }

  getCipherAccessState$(_cipherId: string, _userId: string): Observable<CipherAccessState> {
    // No server transport yet (PM-37264). Emit an empty snapshot rather than
    // throwing: this read only decides whether the cipher-view banner shows
    // anything, so "no leasing state" is the correct passive answer and keeps
    // the banner inert wherever PAM is wired but not yet backed by a server.
    return of({ lease: {} });
  }

  listInboxRequests(): Promise<InboxAccessRequestResponse[]> {
    return Promise.reject(new Error("listInboxRequests is not implemented yet"));
  }

  listInboxHistory(): Promise<InboxAccessRequestResponse[]> {
    return Promise.reject(new Error("listInboxHistory is not implemented yet"));
  }

  getInboxBadgeCount(): Promise<InboxBadgeCountResponse> {
    return Promise.reject(new Error("getInboxBadgeCount is not implemented yet"));
  }

  listMyRequests(): Promise<AccessRequestResponse[]> {
    return Promise.reject(new Error("listMyRequests is not implemented yet"));
  }

  listActiveLeases(): Promise<LeaseResponse[]> {
    return Promise.reject(new Error("listActiveLeases is not implemented yet"));
  }

  getGovernanceSummary(_organizationId: string): Promise<OrganizationGovernanceSummaryResponse> {
    return Promise.reject(new Error("getGovernanceSummary is not implemented yet"));
  }

  bulkRevokeLeases(_organizationId: string, _blockNewLeases: boolean): Promise<BulkRevokeResult> {
    return Promise.reject(new Error("bulkRevokeLeases is not implemented yet"));
  }

  unblockNewLeases(_organizationId: string): Promise<void> {
    return Promise.reject(new Error("unblockNewLeases is not implemented yet"));
  }

  isLeasingFrozen(_organizationId: string): Promise<boolean> {
    return Promise.reject(new Error("isLeasingFrozen is not implemented yet"));
  }

  async patchAccessRequest(
    id: string,
    request: AccessRequestPatchRequest,
  ): Promise<AccessRequestResponse> {
    return new AccessRequestResponse(
      await this.send("PATCH", `/leasing/requests/${id}`, request, true),
    );
  }

  async cancelAccessRequest(id: string): Promise<void> {
    await this.send("DELETE", `/leasing/requests/${id}`, null, false);
  }

  async requestLeaseExtension(request: LeaseExtensionRequest): Promise<AccessRequestResponse> {
    return new AccessRequestResponse(
      await this.send("POST", "/leasing/requests/extension", request, true),
    );
  }

  async decideAccessRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<AccessRequestResponse> {
    return new AccessRequestResponse(
      await this.send("POST", `/leasing/requests/${id}/decision`, request, true),
    );
  }

  async startLease(requestId: string): Promise<LeaseResponse> {
    return new LeaseResponse(
      await this.send("POST", `/leasing/requests/${requestId}/start`, null, true),
    );
  }

  async revokeLease(id: string, request: LeaseRevokeRequest): Promise<void> {
    await this.send("POST", `/leasing/leases/${id}/revoke`, request, false);
  }

  async listAccessRules(organizationId: string): Promise<ListResponse<AccessRuleResponse>> {
    const r = await this.send("GET", `/organizations/${organizationId}/access-rules`, null, true);
    return new ListResponse(r, AccessRuleResponse);
  }

  async getAccessRule(organizationId: string, id: string): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("GET", `/organizations/${organizationId}/access-rules/${id}`, null, true),
    );
  }

  async createAccessRule(
    organizationId: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("POST", `/organizations/${organizationId}/access-rules`, request, true),
    );
  }

  async updateAccessRule(
    organizationId: string,
    id: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("PUT", `/organizations/${organizationId}/access-rules/${id}`, request, true),
    );
  }

  async deleteAccessRule(organizationId: string, id: string): Promise<void> {
    await this.send("DELETE", `/organizations/${organizationId}/access-rules/${id}`, null, false);
  }

  private send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    return this.apiService.send(method, path, body, true, hasResponse);
  }
}
