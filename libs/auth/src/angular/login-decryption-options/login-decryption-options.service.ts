export abstract class LoginDecryptionOptionsService {
  /**
   * Handles client-specific logic that runs after a user was successfully created
   * @param organizationInviteAccepted The `acceptOrganizationInvite` value that we sent to the
   *   server. {@link SsoJitProvisionFinishService.shouldAcceptOrganizationInvite} makes this
   *   decision.
   */
  abstract handleCreateUserSuccess(organizationInviteAccepted: boolean): Promise<void | null>;
}
