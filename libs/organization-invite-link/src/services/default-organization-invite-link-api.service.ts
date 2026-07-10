import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { mapApiErrorToResult } from "@bitwarden/common/models/response/api-error-result";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkAcceptRequest } from "../models/requests/organization-invite-link-accept.request";
import { OrganizationInviteLinkConfirmRequest } from "../models/requests/organization-invite-link-confirm.request";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkRefreshRequest } from "../models/requests/organization-invite-link-refresh.request";
import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { ConfirmOrganizationInviteLinkResult } from "../models/responses/confirm-organization-invite-link-result";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

/**
 * Maps the confirm endpoint's stable RFC 7807 validation error `type` codes (see the server's
 * `ConfirmOrganizationInviteLinkErrors`) to the discrete client result kinds. Any code not listed
 * here falls through to `unexpected-error`.
 */
const SERVER_ERROR_TYPE_TO_KIND: Record<
  string,
  Exclude<ConfirmOrganizationInviteLinkResult["kind"], "ok">
> = {
  invite_link_not_available: "invite-link-not-available",
  email_domain_not_allowed: "email-domain-not-allowed",
  provider_users_cannot_join: "provider-users-cannot-join",
  organization_access_revoked: "organization-access-revoked",
  already_organization_member: "already-organization-member",
  organization_has_no_available_seats: "organization-has-no-available-seats",
  seat_add_failed: "seat-add-failed",
  reset_password_key_required: "reset-password-key-required",
  member_of_another_organization: "member-of-another-organization",
  single_organization_policy: "single-organization-policy",
  two_factor_required_for_membership: "two-factor-required-for-membership",
  only_one_free_organization_admin_allowed: "only-one-free-organization-admin-allowed",
};

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

  async update(
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

  async getStatus(code: string): Promise<OrganizationInviteLinkStatusResponseModel> {
    const r = await this.apiService.send(
      "POST",
      `/organizations/invite-link/status`,
      { code },
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

  async confirm(
    request: OrganizationInviteLinkConfirmRequest,
  ): Promise<ConfirmOrganizationInviteLinkResult> {
    try {
      await this.apiService.send(
        "POST",
        "/organizations/users/invite-link/confirm",
        request,
        true,
        false,
      );
      return { kind: "ok" };
    } catch (e) {
      return mapApiErrorToResult(e, {
        validationErrorTypes: SERVER_ERROR_TYPE_TO_KIND,
        unauthorized: "unauthorized",
        notFound: "invite-link-not-found",
        unexpected: "unexpected-error",
      });
    }
  }
}
