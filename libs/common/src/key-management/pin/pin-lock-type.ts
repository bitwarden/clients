/**
 * - DISABLED   : No PIN set.
 * - PERSISTENT : PIN is set and persists through client reset.
 * - EPHEMERAL  : PIN is set, but does NOT persist through client reset. This means that
 *                after client reset the master password is required to unlock.
 */
export type PinLockType = "DISABLED" | "PERSISTENT" | "EPHEMERAL";
