import { KeyDefinition, ORGANIZATION_INVITE_DISK } from "../../platform/state";

import { DirectOrganizationInvite } from "./direct-organization-invite";
import { OpenOrganizationInvite } from "./open-organization-invite";

/**
 * Persisted direct organization invite (admin targeted a specific user by email).
 * Stored across login/register/MP-policy detours and consumed at accept time.
 *
 * The storage string was renamed from `"organizationInvite"` to
 * `"directOrganizationInvite"` to be symmetric with the open-invite key. Existing
 * on-disk data is moved by migration 81
 * (`state-migrations/migrations/81-rename-organization-invite-to-direct.ts`).
 */
export const DIRECT_ORGANIZATION_INVITE = new KeyDefinition<DirectOrganizationInvite | null>(
  ORGANIZATION_INVITE_DISK,
  "directOrganizationInvite",
  {
    deserializer: (invite) => (invite ? DirectOrganizationInvite.fromJSON(invite) : null),
  },
);

/**
 * Persisted open organization invite (admin published a reusable link anyone can use).
 * Stored from the open-invite landing page through the post-auth accept call.
 *
 * Greenfield key — no migration needed because no prior data exists under this name.
 */
export const OPEN_ORGANIZATION_INVITE = new KeyDefinition<OpenOrganizationInvite | null>(
  ORGANIZATION_INVITE_DISK,
  "openOrganizationInvite",
  {
    deserializer: (invite) => (invite ? OpenOrganizationInvite.fromJSON(invite) : null),
  },
);
