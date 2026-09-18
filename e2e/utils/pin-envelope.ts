/** Where the PIN-protected user key is kept, decided at enrollment time. */
export const PinEnvelope = Object.freeze({
  /** After first unlock: in memory only, so a restart requires the master password. */
  Ephemeral: "ephemeral",
  /** Before first unlock: on disk, so the PIN keeps working after a restart. */
  Persistent: "persistent",
} as const);
export type PinEnvelope = (typeof PinEnvelope)[keyof typeof PinEnvelope];
