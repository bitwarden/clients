/**
 * SSO configuration snapshot for an open org invite link, captured from the open-invite
 * status endpoint. Present only when the inviting org has SSO both configured and
 * enabled. Persisted on {@link OpenOrganizationInvite} so login/registration can
 * decide SSO routing without re-calling status.
 */
export interface OpenOrgInviteSsoConfig {
  orgSsoId: string;
  required: boolean;
}

/**
 * Payload shape carried on the `ok` variant of {@link OpenOrgInviteStatusResult}.
 * Discriminator-encoded fields (`linksEnabled`, `seatsAvailable`) are omitted — they
 * are always true when `ok` is returned, so keeping them on the payload would let
 * illegal states be typed (see the result union file for the fuller rationale).
 */
export interface OpenOrgInviteStatus {
  organizationName: string;
  sso: OpenOrgInviteSsoConfig | null;
}
