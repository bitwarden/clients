import { Jsonify } from "type-fest";

import { ORGANIZATION_INVITE_LINK_DISK, UserKeyDefinition } from "@bitwarden/state";

import { OrganizationInviteLink } from "../models/responses/organization-invite-link.response";

export const ORGANIZATION_INVITE_LINK_KEY = new UserKeyDefinition<
  OrganizationInviteLink | undefined
>(ORGANIZATION_INVITE_LINK_DISK, "inviteLink", {
  deserializer: (obj: Jsonify<OrganizationInviteLink>) =>
    obj == null ? undefined : OrganizationInviteLink.fromJSON(obj),
  clearOn: ["logout"],
});
