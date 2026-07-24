import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkAcceptRequest } from "../models/requests/organization-invite-link-accept.request";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkInviteRequest } from "../models/requests/organization-invite-link-invite.request";
import { OrganizationInviteLinkRefreshRequest } from "../models/requests/organization-invite-link-refresh.request";
import { OrganizationInviteLinkUpdateSupportConfirmationRequest } from "../models/requests/organization-invite-link-update-support-confirmation.request";
import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { OrganizationInviteLinkInviteResponse } from "../models/responses/organization-invite-link-invite.response";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";
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

  async refresh(
    organizationId: string,
    request: OrganizationInviteLinkRefreshRequest,
  ): Promise<OrganizationInviteLinkResponseModel> {
    const r = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/invite-link/refresh`,
      request,
      true,
      true,
    );
    return new OrganizationInviteLinkResponseModel(r);
  }

  async updateSupportsConfirmation(
    organizationId: OrganizationId,
    request: OrganizationInviteLinkUpdateSupportConfirmationRequest,
  ): Promise<OrganizationInviteLinkResponseModel> {
    const r = await this.apiService.send(
      "PUT",
      `/organizations/${organizationId}/invite-link/support-confirm`,
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

  async updateAllowedDomains(
    organizationId: string,
    request: OrganizationInviteLinkUpdateRequest,
  ): Promise<OrganizationInviteLinkResponseModel> {
    const r = await this.apiService.send(
      "PUT",
      `/organizations/${organizationId}/invite-link`,
      request,
      true,
      true,
    );
    return new OrganizationInviteLinkResponseModel(r);
  }

  async delete(organizationId: string): Promise<void> {
    await this.apiService.send(
      "DELETE",
      `/organizations/${organizationId}/invite-link`,
      null,
      true,
      false,
    );
  }

  async validateEmailDomain(
    request: OrganizationInviteLinkValidateEmailDomainRequest,
  ): Promise<OrganizationInviteLinkValidateEmailDomainResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/invite-link/validate-email-domain",
      request,
      false,
      true,
    );
    return new OrganizationInviteLinkValidateEmailDomainResponse(r);
  }

  async getStatus(
    organizationId: string,
    code: string,
  ): Promise<OrganizationInviteLinkStatusResponseModel> {
    const r = await this.apiService.send(
      "POST",
      `/organizations/invite-link/status`,
      { organizationId, code },
      false,
      true,
    );
    return new OrganizationInviteLinkStatusResponseModel(r);
  }

  async accept(request: OrganizationInviteLinkAcceptRequest): Promise<void> {
    await this.apiService.send(
      "POST",
      "/organizations/users/invite-link/accept",
      request,
      true,
      false,
    );
  }

  async getInvite(
    request: OrganizationInviteLinkInviteRequest,
  ): Promise<OrganizationInviteLinkInviteResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/users/invite-link/invite",
      request,
      true,
      true,
    );
    return new OrganizationInviteLinkInviteResponse(r);
  }
}
