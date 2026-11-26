import { Observable } from "rxjs";

import { PeerLockState } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";

/**
 * This device's participant in the shared unlock protocol.
 */
export abstract class SharedUnlockPeerService {
  /**
   * Starts the shared unlock protocol for this device's participant.
   */
  abstract start(): Promise<void>;

  /**
   * The lock states peers report for the user, one per sync this device accepts. An `Unlocked`
   * emission means the peer's user key has already been applied through
   * `UnlockService.unlockFromSharedUnlock`; a `Locked` one means a peer answered and has
   * nothing to share. No emission at all means no peer answered.
   */
  abstract peerState$(userId: UserId): Observable<PeerLockState>;
}
