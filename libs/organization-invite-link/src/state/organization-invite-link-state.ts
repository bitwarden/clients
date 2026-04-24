import { ORGANIZATION_INVITE_LINK_DISK, UserKeyDefinition } from "@bitwarden/state";

import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export const ORGANIZATION_INVITE_LINK_KEY = new UserKeyDefinition<
  OrganizationInviteLinkResponseModel | undefined
>(ORGANIZATION_INVITE_LINK_DISK, "inviteLink", {
  deserializer: (obj) =>
    obj == null ? undefined : Object.assign(new OrganizationInviteLinkResponseModel(obj), obj),
  clearOn: ["logout"],
});
