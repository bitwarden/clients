import { Observable } from "rxjs";

import { PeerLockState } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";

/**
 * This device's participant in the shared unlock protocol.
 */
export abstract class SharedUnlockPeerService {
  /**
   * Starts the shared unlock protocol for this device's participant.
   *
   * @param abortController Cancels the peer's receive loop and sync timer.
   */
  abstract start(abortController?: AbortController): Promise<void>;

  /**
   * The states this device's peers report for a user, starting with the last one reported.
   */
  abstract peerState$(userId: UserId): Observable<PeerLockState>;
}
