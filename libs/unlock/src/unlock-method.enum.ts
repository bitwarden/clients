/**
 * How a user was unlocked. Handed to every callback registered through
 * {@link UnlockService.registerOnUnlockAction} and emitted on {@link UnlockService.unlocked$}, so a
 * listener can tell the unlocks it caused itself apart from the ones it should react to, and can
 * treat individual methods differently.
 */
export const UnlockMethod = Object.freeze({
  MasterPassword: "masterPassword",
  Pin: "pin",
  Biometrics: "biometrics",
  Prf: "prf",
  KeyConnector: "keyConnector",
  DecryptedUserKey: "decryptedUserKey",
  SharedUnlock: "sharedUnlock",
  AutoKey: "autoKey",
} as const);
export type UnlockMethod = (typeof UnlockMethod)[keyof typeof UnlockMethod];
