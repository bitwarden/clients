/**
 * This enum is used to determine if a user should be forced to set an initial password or
 * change their existing password upon login (communicated via server flag) or upon unlocking
 * with their master password (set via client evaluation).
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ForceSetPasswordReason {
  /**
   * A password set/change should not be forced.
   */
  None,

  /*--------------------------
      Set Initial Password  
  ---------------------------*/

  /**
   * Occurs when a user JIT provisions into a master-password-encryption org via SSO and must set their initial password.
   */
  SsoNewJitProvisionedUser,

  /**
   * Occurs when a TDE org user without a password obtains the password reset ("manage account recovery")
   * permission, which requires the TDE user to have/set a password.
   *
   * Set post login & decryption client side and by server in sync (to catch logged in users).
   */
  TdeUserWithoutPasswordHasPasswordResetPermission,

  /**
   * Occurs when an org admin switches the org from trusted-device-encryption to master-password-encryption,
   * which forces the org user to set an initial password. User must not already have a master password,
   * and they must be on a previously trusted device.
   *
   * Communicated via server flag.
   */
  TdeOffboarding,

  /**
   * Occurs when an org admin switches the org from trusted-device-encryption to master-password-encryption,
   * which forces the org user to set an initial password. User must not already have a master password,
   * and they must be on an untrusted device.
   *
   * Calculated on client based on server flags and user state.
   */
  TdeOffboardingUntrustedDevice,

  /*----------------------------
      Change Existing Password  
  -----------------------------*/

  /**
   * Occurs when an org admin forces a user to change their password via Account Recovery.
   *
   * Communicated via server flag.
   */
  AdminForcePasswordReset,

  /**
   * Occurs when a user logs in / unlocks their vault with a master password that does not meet an org's
   * master password policy that is enforced on login/unlock.
   *
   * Only set client side b/c server can't evaluate MP.
   */
  WeakMasterPassword,
}
