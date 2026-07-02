/**
 * SSO configuration snapshot for an open invite link, captured from the open-invite
 * status endpoint. Present only when the inviting org has SSO both configured and
 * enabled. Persisted on {@link OpenOrganizationInvite} so login/registration can
 * decide SSO routing without re-calling status.
 */
export interface OpenOrgInviteSsoConfig {
  orgSsoId: string;
  required: boolean;
}

/**
 * Successful-response shape from the open-invite status endpoint
 * (`OrganizationInviteService.getOpenOrgInviteStatus(code)`). The service wraps this
 * in an {@link OpenOrgInviteStatusResult} to encapsulate the endpoint's error
 * modes into a single discriminated return.
 */
export interface OpenOrgInviteStatusResponse {
  organizationId: string;
  organizationName: string;
  seatsAvailable: boolean;
  sso: OpenOrgInviteSsoConfig | null;
}
