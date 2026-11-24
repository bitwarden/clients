/**
 * The result of one SSO JIT provision finish call.
 */
export interface SsoJitProvisionFinishResult<TRegistration> {
  /** The SDK registration response. The caller writes local state from it. */
  registration: TRegistration;
  /**
   * Whether the server moved the organization membership from Invited to Accepted. The value is
   * `false` only for a stored open invite while the `pm-34429-invite-link-auto-confirm` flag is on.
   */
  organizationInviteAccepted: boolean;
}
