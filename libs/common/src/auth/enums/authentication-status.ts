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
   *  - Which means: the user does not have their encrypted vault data in state
   */
  LoggedOut = 0,

  /**
   * User is authenticated but not decrypted
   *  - The user has an access token, but no user key in state
   *  - Which means: the user has their encrypted vault data in state, but has not decrypted it
   */
  Locked = 1,

  /**
   * User is authenticated and decrypted
   *  - The user has an access token and a user key in state
   *  - Which means: the user has their decrypted vault data in state
   */
  Unlocked = 2,
}
