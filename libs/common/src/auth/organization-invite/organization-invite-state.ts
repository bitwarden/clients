import { KeyDefinition, ORGANIZATION_INVITE_DISK } from "../../platform/state";

import { DirectOrganizationInvite } from "./direct-organization-invite";

/**
 * Persisted direct organization invite (admin targeted a specific user by email). Stored
 * across login/register/MP-policy detours and consumed at accept time.
 *
 * Storage string is still `"organizationInvite"` until a follow-up commit lands the
 * `"directOrganizationInvite"` rename + state-provider migration. Renaming the variable
 * to `DIRECT_ORGANIZATION_INVITE` ahead of the storage rename keeps in-code naming
 * symmetric with the upcoming `OPEN_ORGANIZATION_INVITE` key without a destructive
 * change to on-disk state.
 */
export const DIRECT_ORGANIZATION_INVITE = new KeyDefinition<DirectOrganizationInvite | null>(
  ORGANIZATION_INVITE_DISK,
  "organizationInvite",
  {
    deserializer: (invite) => (invite ? DirectOrganizationInvite.fromJSON(invite) : null),
  },
);
