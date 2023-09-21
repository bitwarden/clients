/*
 * This enum is used to determine if a user should be forced to reset their password
 * on login (server flag) or unlock via MP (client evaluation).
 */
export enum ForceResetPasswordReason {
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
}
