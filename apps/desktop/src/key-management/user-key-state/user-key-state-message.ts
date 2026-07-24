export const UserKeyStateAction = Object.freeze({
  Get: "get",
  Set: "set",
} as const);
export type UserKeyStateAction = (typeof UserKeyStateAction)[keyof typeof UserKeyStateAction];

/**
 * Request from the renderer to the main process over the "userKeyState" channel.
 * Keys are serialized with SymmetricCryptoKey.toBase64 and rehydrated with
 * SymmetricCryptoKey.fromString, since prototypes are lost over IPC.
 */
export type UserKeyStateMessage = {
  action: UserKeyStateAction;
  userId: string;
  /** Serialized user key, or null to clear (only for the "set" action). */
  key?: string | null;
};

/** Pushed from the main process to the renderer on the "userKeyState.update" channel. */
export type UserKeyStateUpdate = {
  userId: string;
  key: string | null;
};
