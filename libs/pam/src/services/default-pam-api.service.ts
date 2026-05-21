import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { GatedCipherFetchResult } from "../abstractions/gated-cipher-fetch-result";
import { PamApiService } from "../abstractions/pam-api.service";
import { CollectionLeasingConfigResponse } from "../abstractions/responses/collection-leasing.response";
import { InboxBadgeCountResponse } from "../abstractions/responses/inbox-badge-count.response";
import { InboxLeaseRequestResponse } from "../abstractions/responses/inbox-lease-request.response";
import { LeaseRequestResponse } from "../abstractions/responses/lease-request.response";

import { CollectionLeasingRequest } from "./requests/collection-leasing.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "./requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

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

  async setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse> {
    return new CollectionLeasingConfigResponse(
      await this.send("PUT", `/collections/${id}/leasing`, request, true),
    );
  }

  async listInboxRequests(): Promise<InboxLeaseRequestResponse[]> {
    const response = (await this.send("GET", "/leasing/requests/inbox", null, true)) as unknown;
    const rows = Array.isArray(response) ? response : [];
    return rows.map((row) => new InboxLeaseRequestResponse(row));
  }

  async submitDecision(
    requestId: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse> {
    return this.decideLeaseRequest(requestId, request);
  }

  async getInboxBadgeCount(): Promise<InboxBadgeCountResponse> {
    return new InboxBadgeCountResponse(
      await this.send("GET", "/leasing/requests/inbox/count", null, true),
    );
  }

  async listInboxHistory(): Promise<InboxLeaseRequestResponse[]> {
    const response = (await this.send(
      "GET",
      "/leasing/requests/inbox/history",
      null,
      true,
    )) as unknown;
    const rows = Array.isArray(response) ? response : [];
    return rows.map((row) => new InboxLeaseRequestResponse(row));
  }

  private send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    return this.apiService.send(method, path, body, true, hasResponse);
  }
}
