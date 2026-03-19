// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum WebauthnLoginCredentialPrfStatus {
  /**
   * Encrypted user key present, PRF function is supported.
   */
  Enabled = 0,
  /**
   * PRF function is supported.
   */
  Supported = 1,
  /**
   * PRF function is not supported.
   */
  Unsupported = 2,
}
