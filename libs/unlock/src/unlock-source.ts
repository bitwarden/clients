import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

/**
 * Why an unlock happened.
 *
 * Derived by {@link UnlockService} from the unlock method used. Consumers of
 * {@link UnlockService.registerOnUnlockAction} use this to avoid reacting to unlocks they caused
 * themselves. Shared unlock, for instance, ignores {@link UnlockSource.SharedUnlock} so that an
 * unlock propagated from another device is not broadcast straight back out.
 */
export const UnlockSource = Object.freeze({
  /** A user-driven unlock: master password, PIN, biometrics, key connector, or a decrypted user key. */
  Manual: "manual",
  /** A bootstrap unlock using the persisted never-lock ("auto") key. */
  NeverLock: "neverLock",
  /** Another device unlocked, and shared unlock propagated that unlock into this client. */
  SharedUnlock: "sharedUnlock",
} as const);

export type UnlockSource = UnionOfValues<typeof UnlockSource>;
