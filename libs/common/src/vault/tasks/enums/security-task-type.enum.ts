// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SecurityTaskType {
  /**
   * Task to update a cipher's password that was found to be at-risk by an administrator
   */
  UpdateAtRiskCredential = 0,
}
