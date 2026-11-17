import { OrganizationInviteLinkValidateEmailDomainRequest } from "../models/requests/organization-invite-link-validate-email-domain.request";
import { OrganizationInviteLinkStatusResponseModel } from "../models/responses/organization-invite-link-status.response";
import { OrganizationInviteLinkValidateEmailDomainResponse } from "../models/responses/organization-invite-link-validate-email-domain.response";

/**
 * @deprecated Use the SDK instead - see the invite_link() client.
 */
export abstract class OrganizationInviteLinkApiService {
  /**
   * @deprecated Use the SDK instead: invite_link().user().is_email_allowed
   *
   * Check whether an email's domain is permitted by the invite link
   */
  abstract validateEmailDomain(
    request: OrganizationInviteLinkValidateEmailDomainRequest,
  ): Promise<OrganizationInviteLinkValidateEmailDomainResponse>;

  /**
   * @deprecated Use the SDK instead: invite_link().user().get_status
   *
   * Get the public status of an invite link (anonymous)
   */
  abstract getStatus(
    organizationId: string,
    code: string,
  ): Promise<OrganizationInviteLinkStatusResponseModel>;
}
