import { UserId } from "../../types/guid";

/**
 * A lock state a peer reported for a user, stripped of key material.
 *
 * Mirrors the SDK's `PeerLockState`, which the installed `@bitwarden/sdk-internal` does not export
 * yet. Swap this for the SDK type once the bump that adds the driver hook lands; the values are the
 * serialized form of its variants, so the two are interchangeable.
 */
export const PeerLockState = Object.freeze({
  Locked: "Locked",
  Unlocked: "Unlocked",
} as const);
export type PeerLockState = (typeof PeerLockState)[keyof typeof PeerLockState];

/** What a peer reported for one user. */
export type PeerState = {
  userId: UserId;
  lockState: PeerLockState;
};
