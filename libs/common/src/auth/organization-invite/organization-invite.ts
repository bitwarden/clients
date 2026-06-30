import { DirectOrganizationInvite } from "./direct-organization-invite";
import { OpenOrganizationInvite } from "./open-organization-invite";

/**
 * Discriminated union of organization invite variants:
 * - {@link DirectOrganizationInvite} — admin targeted a specific user by email
 *   (`kind === OrgInviteKind.Direct`).
 * - {@link OpenOrganizationInvite} — admin published a reusable link anyone can use
 *   (`kind === OrgInviteKind.Open`).
 *
 * Narrow by `kind` for variant-specific access. The file name is preserved so existing
 * import sites that only want the union type are unaffected.
 */
export type OrganizationInvite = DirectOrganizationInvite | OpenOrganizationInvite;
