/**
 * What caused an unlock. Handed to every callback registered through
 * {@link UnlockService.registerOnUnlockAction} so a listener can tell the unlocks it caused itself
 * apart from the ones it should react to.
 */
export const UnlockSource = Object.freeze({
  /**
   * The user unlocked this device themselves — master password, PIN, biometrics, key connector,
   * PRF, or logging in with another device.
   */
  Manual: "manual",
  /**
   * The vault was restored from the never-lock key rather than unlocked by anyone.
   *
   * Nothing reports this yet: the never-lock restore in `UserAutoUnlockKeyService` sets the user key
   * directly instead of going through `UnlockService`.
   */
  Auto: "auto",
  /** Another device unlocked this one over the shared unlock protocol. */
  SharedUnlock: "sharedUnlock",
} as const);
export type UnlockSource = (typeof UnlockSource)[keyof typeof UnlockSource];
