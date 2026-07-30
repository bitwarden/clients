import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { KeyDefinition, ORGANIZATION_INVITE_DISK } from "@bitwarden/common/platform/state";

// We're storing the organization invite for 2 reasons:
// 1. If the org requires a MP policy check, we need to keep track that the user has already been redirected when they return.
// 2. The MP policy check happens on login/register flows, we need to store the token to retrieve the policies then.
export const ORGANIZATION_INVITE = new KeyDefinition<OrganizationInvite | null>(
  ORGANIZATION_INVITE_DISK,
  "organizationInvite",
  {
    deserializer: (invite) => (invite ? OrganizationInvite.fromJSON(invite) : null),
  },
);
