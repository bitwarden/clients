import { OrganizationInviteLinkAcceptRequest } from "../models/requests/organization-invite-link-accept.request";
import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkRefreshRequest } from "../models/requests/organization-invite-link-refresh.request";
import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkApiService {
  /** Create or replace the invite link for the given organization */
  abstract create(
    organizationId: string,
    request: OrganizationInviteLinkCreateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Update the allowed domains for the given organization's invite link */
  abstract update(
    organizationId: string,
    request: OrganizationInviteLinkUpdateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Refresh the invite link for the given organization, issuing a new code and key */
  abstract refresh(
    organizationId: string,
    request: OrganizationInviteLinkRefreshRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Retrieve the invite link for the given organization */
  abstract get(organizationId: string): Promise<OrganizationInviteLinkResponseModel>;

  /** Delete (revoke) the invite link for the given organization */
  abstract delete(organizationId: string): Promise<void>;

  /** Check whether an email's domain is permitted by the invite link */
  abstract validateEmailDomain(
    request: OrganizationInviteLinkValidateEmailDomainRequest,
  ): Promise<OrganizationInviteLinkValidateEmailDomainResponse>;

  /** Get the public status of an invite link by its code (anonymous) */
  abstract getStatus(code: string): Promise<OrganizationInviteLinkStatusResponseModel>;

  /** Accept an invite link, joining the authenticated user to the organization */
  abstract accept(request: OrganizationInviteLinkAcceptRequest): Promise<void>;
}
