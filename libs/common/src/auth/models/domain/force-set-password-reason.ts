/*
 * This enum is used to determine if a user should be forced to initially set or reset their password
 * on login (server flag) or unlock via MP (client evaluation).
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ForceSetPasswordReason {
  /**
   * A password reset should not be forced.
   */
  None,

  /**
   * Occurs when an organization admin forces a user to reset their password.
   * Communicated via server flag.
   */
  AdminForcePasswordReset,

  /**
   * Occurs when a user logs in / unlocks their vault with a master password that does not meet an organization's
   * master password policy that is enforced on login/unlock.
   * Only set client side b/c server can't evaluate MP.
   */
  WeakMasterPassword,

  /**
   * Occurs when a TDE user without a password obtains the password reset permission.
   * Set post login & decryption client side and by server in sync (to catch logged in users).
   */
  TdeUserWithoutPasswordHasPasswordResetPermission,

  /**
   * Occurs when TDE is disabled and master password has to be set.
   */
  TdeOffboarding,

  /**
   * Occurs when a new SSO user is JIT provisioned and needs to set their master password.
   */
  SsoNewJitProvisionedUser,
}
