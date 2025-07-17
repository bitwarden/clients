/**
 * The authentication status of the user
 *
 * See `AuthService.authStatusFor$` for details on how we determine the user's `AuthenticationStatus`
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AuthenticationStatus {
  /**
   * User is not authenticated
   *  - The user does not have an active account userId and/or an access token in state
   */
  LoggedOut = 0,

  /**
   * User is authenticated but not decrypted
   *  - The user has an access token, but no user key in state
   *  - Vault data cannot be decrypted (because there is no user key)
   */
  Locked = 1,

  /**
   * User is authenticated and decrypted
   *  - The user has an access token and a user key in state
   *  - Vault data can be decrypted (via user key)
   */
  Unlocked = 2,
}
