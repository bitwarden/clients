import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

import { PeerLockState } from "./peer-state";

/**
 * This device's participant in the shared unlock protocol.
 */
export abstract class SharedUnlockPeerService {
  /**
   * Starts the shared unlock protocol for this device's participant.
   *
   * @param abortController Cancels the peer's receive loop and sync timer. Clients that outlive
   * their peer may omit it; short-lived ones must pass it, because the sync timer keeps the
   * process alive on its own.
   */
  abstract start(abortController?: AbortController): Promise<void>;

  /**
   * The states this device's peers report for a user, starting with the last one reported.
   *
   * Carries every accepted sync, not only the ones that changed something, so a client waiting to
   * borrow an unlock learns that a peer answered even when the answer is "locked".
   */
  abstract peerState$(userId: UserId): Observable<PeerLockState>;
}
