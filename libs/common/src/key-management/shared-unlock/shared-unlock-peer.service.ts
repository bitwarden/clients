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
}
