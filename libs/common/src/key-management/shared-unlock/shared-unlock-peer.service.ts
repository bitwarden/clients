/**
 * This device's participant in the shared unlock protocol.
 */
export abstract class SharedUnlockPeerService {
  /**
   * Starts the shared unlock protocol for this device's participant.
   */
  abstract start(): Promise<void>;
}
