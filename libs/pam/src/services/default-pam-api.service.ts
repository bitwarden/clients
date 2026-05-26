import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { GatedCipherFetchResult } from "../abstractions/gated-cipher-fetch-result";
import { PamApiService } from "../abstractions/pam-api.service";
import { LeaseRequestResponse } from "../abstractions/responses/lease-request.response";
import { LeasingPolicyResponse } from "../abstractions/responses/leasing-policy.response";

import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "./requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";
import { LeasingPolicyRequest } from "./requests/leasing-policy.request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class DefaultPamApiService implements PamApiService {
  constructor(private apiService: ApiService) {}

  // TODO(PM-37264): implement the cipher-fetch transport. ApiService.send is
  // unsuitable here because it rejects every non-200 via ErrorResponse (dropping
  // the response body — so a 202 carrying a LeaseRequest can't be reconstructed)
  // and calls logoutCallback("invalidAccessToken") on any authenticated 403,
  // which would log the user out on every "denied" verdict.
  fetchGatedCipher(_id: string): Promise<GatedCipherFetchResult> {
    return Promise.reject(new Error("fetchGatedCipher is not implemented yet; see PM-37264"));
  }

  async patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("PATCH", `/leasing/requests/${id}`, request, true),
    );
  }

  async cancelLeaseRequest(id: string): Promise<void> {
    await this.send("DELETE", `/leasing/requests/${id}`, null, false);
  }

  async requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("POST", "/leasing/requests/extension", request, true),
    );
  }

  async decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("POST", `/leasing/requests/${id}/decision`, request, true),
    );
  }

  async revokeLease(id: string, request: LeaseRevokeRequest): Promise<void> {
    await this.send("POST", `/leasing/leases/${id}/revoke`, request, false);
  }

  async listLeasingPolicies(organizationId: string): Promise<ListResponse<LeasingPolicyResponse>> {
    const r = await this.send(
      "GET",
      `/organizations/${organizationId}/leasing-policies`,
      null,
      true,
    );
    return new ListResponse(r, LeasingPolicyResponse);
  }

  async getLeasingPolicy(organizationId: string, id: string): Promise<LeasingPolicyResponse> {
    return new LeasingPolicyResponse(
      await this.send("GET", `/organizations/${organizationId}/leasing-policies/${id}`, null, true),
    );
  }

  async createLeasingPolicy(
    organizationId: string,
    request: LeasingPolicyRequest,
  ): Promise<LeasingPolicyResponse> {
    return new LeasingPolicyResponse(
      await this.send("POST", `/organizations/${organizationId}/leasing-policies`, request, true),
    );
  }

  async updateLeasingPolicy(
    organizationId: string,
    id: string,
    request: LeasingPolicyRequest,
  ): Promise<LeasingPolicyResponse> {
    return new LeasingPolicyResponse(
      await this.send(
        "PUT",
        `/organizations/${organizationId}/leasing-policies/${id}`,
        request,
        true,
      ),
    );
  }

  async deleteLeasingPolicy(organizationId: string, id: string): Promise<void> {
    await this.send(
      "DELETE",
      `/organizations/${organizationId}/leasing-policies/${id}`,
      null,
      false,
    );
  }

  private send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    return this.apiService.send(method, path, body, true, hasResponse);
  }
}
