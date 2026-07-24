import { UserId } from "@bitwarden/user-core";

export const USER_KEY_STATE_PORT_NAME = "user_key_state_port";

/**
 * Message exchanged over the user key state port between the popup (foreground)
 * and the background. Keys are serialized with SymmetricCryptoKey.toBase64 and
 * rehydrated with SymmetricCryptoKey.fromString.
 */
export type UserKeyStatePortMessage = {
  originator: "foreground" | "background";
  /** Correlation id for request/response pairs. */
  id?: string;
  action: "get" | "set" | "update" | "initialization";
  userId?: UserId;
  /** Serialized user key, or null when the user has no key (locked). */
  key?: string | null;
  /** Snapshot of all users' keys, sent to a newly connected port. */
  data?: [UserId, string | null][];
};
