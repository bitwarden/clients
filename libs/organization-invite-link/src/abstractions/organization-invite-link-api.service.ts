import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkApiService {
  /** Update the allowed domains on an existing invite link */
  abstract updateAllowedDomains(
    organizationId: string,
    request: OrganizationInviteLinkUpdateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Retrieve the invite link for the given organization */
  abstract get(organizationId: string): Promise<OrganizationInviteLinkResponseModel>;

  /** Delete (revoke) the invite link for the given organization */
  abstract delete(organizationId: string): Promise<void>;

  /** Check whether an email's domain is permitted by the invite link */
  abstract validateEmailDomain(
    request: OrganizationInviteLinkValidateEmailDomainRequest,
  ): Promise<OrganizationInviteLinkValidateEmailDomainResponse>;

  /** Get the public status of an invite link (anonymous) */
  abstract getStatus(
    organizationId: string,
    code: string,
  ): Promise<OrganizationInviteLinkStatusResponseModel>;
}
