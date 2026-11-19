import { Observable } from "rxjs";

import { CipherId, UserId } from "@bitwarden/common/types/guid";

/** The SSH key of a gated item the user holds a live lease on. */
export type LeasedSshKey = {
  cipherId: CipherId;
  name: string;
  privateKey: string;
  /** When the lease ends, in Unix milliseconds. The agent drops the key then. */
  leaseEndsAt: number;
};

/**
 * Leased SSH keys for the SSH agent. A licensed feature fills it; unprovided, the agent serves
 * only ordinary keys, exactly as without it.
 *
 * Every implementation must follow these rules:
 * - Hand out only keys under a live lease of the given user, with `leaseEndsAt` no later than the
 *   lease's end.
 * - Keep the keys in renderer memory only, never in state. The agent's keystore is the one other
 *   place a leased key may be, and only while its lease is live.
 * - {@link leasedKeys$} emits again on every change: a reveal, a lease ending, lapsing, being
 *   revoked or extended, a lock, a logout and an account switch. It emits an empty list for a user
 *   who is not the active, unlocked user.
 * - {@link liveKey} and {@link liveKeys} check the lease against the clock at the moment of the
 *   call, so a lapsed lease answers nothing even before {@link leasedKeys$} has caught up.
 */
export abstract class LeasedSshKeyService {
  /** The user's live leased SSH keys; starts with the current list. */
  abstract leasedKeys$(userId: UserId): Observable<LeasedSshKey[]>;
  /** The user's live leased SSH keys right now. */
  abstract liveKeys(userId: UserId): LeasedSshKey[];
  /** The key while the user's lease on `cipherId` is live right now, else `undefined`. */
  abstract liveKey(userId: UserId, cipherId: CipherId): LeasedSshKey | undefined;
}
