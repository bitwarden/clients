import { OrganizationInviteLinkCreateRequest } from "../models/requests/organization-invite-link-create.request";
import { OrganizationInviteLinkUpdateRequest } from "../models/requests/organization-invite-link-update.request";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkApiService {
  /** Create or replace the invite link for the given organization */
  abstract create(
    organizationId: string,
    request: OrganizationInviteLinkCreateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Update allowed domains on the invite link for the given organization */
  abstract update(
    organizationId: string,
    request: OrganizationInviteLinkUpdateRequest,
  ): Promise<OrganizationInviteLinkResponseModel>;

  /** Retrieve the invite link for the given organization */
  abstract get(organizationId: string): Promise<OrganizationInviteLinkResponseModel>;

  /** Delete (revoke) the invite link for the given organization */
  abstract delete(organizationId: string): Promise<void>;
}
