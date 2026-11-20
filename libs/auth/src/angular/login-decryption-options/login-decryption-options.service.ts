export abstract class LoginDecryptionOptionsService {
  /**
   * Handles client-specific logic that runs after a user was successfully created
   * @param organizationInviteAccepted The `acceptOrganizationInvite` value that we sent to the
   *   server. `false` only when `pm-34429-invite-link-auto-confirm` is on and the stored open
   *   invite is for the provisioning organization.
   */
  abstract handleCreateUserSuccess(organizationInviteAccepted: boolean): Promise<void | null>;
}
