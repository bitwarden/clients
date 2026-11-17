import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";

export class DefaultOrganizationInviteLinkApiService implements OrganizationInviteLinkApiService {
  constructor(private apiService: ApiService) {}

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
}
