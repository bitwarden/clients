/**
 * Discriminator for the {@link OrganizationInvite} union. Identifies which kind of
 * invite the union member represents:
 * - `Direct` — admin targeted a specific user by email; identity carried in the URL.
 * - `Open` — anyone holding the link can join; no user identity in the URL.
 */
export const OrgInviteKind = Object.freeze({
  Direct: "direct",
  Open: "open",
} as const);

export type OrgInviteKind = (typeof OrgInviteKind)[keyof typeof OrgInviteKind];
