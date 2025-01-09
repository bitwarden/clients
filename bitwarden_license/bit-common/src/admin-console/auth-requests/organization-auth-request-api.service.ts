import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { AdminAuthRequestUpdateRequest } from "./admin-auth-request-update.request";
import { BulkDenyAuthRequestsRequest } from "./bulk-deny-auth-requests.request";
import { OrganizationAuthRequestUpdateRequest } from "./organization-auth-request-update.request";
import { PendingAuthRequestView } from "./pending-auth-request.view";
import { PendingOrganizationAuthRequestResponse } from "./pending-organization-auth-request.response";

export class OrganizationAuthRequestApiService {
  constructor(private apiService: ApiService) {}

  async listPendingRequests(organizationId: string): Promise<PendingAuthRequestView[]> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/auth-requests`,
      null,
      true,
      true,
    );

    const listResponse = new ListResponse(r, PendingOrganizationAuthRequestResponse);

    return listResponse.data.map((ar) => PendingAuthRequestView.fromResponse(ar));
  }

  async denyPendingRequests(organizationId: string, ...requestIds: string[]): Promise<void> {
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/auth-requests/deny`,
      new BulkDenyAuthRequestsRequest(requestIds),
      true,
      false,
    );
  }

  async bulkUpdatePendingRequests(
    organizationId: string,
    items: OrganizationAuthRequestUpdateRequest[],
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/auth-requests`,
      items,
      true,
      false,
    );
  }

  async approvePendingRequest(
    organizationId: string,
    requestId: string,
    encryptedKey: EncString,
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/auth-requests/${requestId}`,
      new AdminAuthRequestUpdateRequest(true, encryptedKey.encryptedString),
      true,
      false,
    );
  }

  async denyPendingRequest(organizationId: string, requestId: string): Promise<void> {
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/auth-requests/${requestId}`,
      new AdminAuthRequestUpdateRequest(false),
      true,
      false,
    );
  }
}
