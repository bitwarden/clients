/**
 * What caused a lock. Handed to every callback registered through
 * {@link LockService.registerOnLockAction} so a listener can tell the locks it caused itself apart
 * from the ones it should react to.
 */
export const LockSource = Object.freeze({
  /** The vault timeout elapsed, the system locked, or the client idled out. */
  VaultTimeout: "vaultTimeout",
  /** The user locked this device themselves. */
  Manual: "manual",
  /** Another device locked this one over the shared unlock protocol. */
  SharedUnlock: "sharedUnlock",
} as const);
export type LockSource = (typeof LockSource)[keyof typeof LockSource];
