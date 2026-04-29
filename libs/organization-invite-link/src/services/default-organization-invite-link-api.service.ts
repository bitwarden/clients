import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export class DefaultOrganizationInviteLinkApiService implements OrganizationInviteLinkApiService {
  constructor(private apiService: ApiService) {}

  async create(
    organizationId: string,
    request: OrganizationInviteLinkCreateRequest,
  ): Promise<OrganizationInviteLinkResponseModel> {
    const r = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/invite-link`,
      request,
      true,
      true,
    );
    return new OrganizationInviteLinkResponseModel(r);
  }

  async get(organizationId: string): Promise<OrganizationInviteLinkResponseModel> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/invite-link`,
      null,
      true,
      true,
    );
    return new OrganizationInviteLinkResponseModel(r);
  }
}
