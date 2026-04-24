import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkApiService {
  /** Create or replace the invite link for the given organization */
  abstract create(
    organizationId: string,
    request: OrganizationInviteLinkCreateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Retrieve the current invite link for the given organization */
  abstract get(organizationId: string): Promise<OrganizationInviteLinkResponseModel>;

  /** Delete (revoke) the invite link for the given organization */
  abstract delete(organizationId: string): Promise<void>;
}
