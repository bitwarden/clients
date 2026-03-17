/**
 * In-memory implementation of the proxy client interface for integration testing.
 *
 * No network — stores the onMessage callback and exposes helpers for tests
 * to inject proxy messages and inspect sent commands.
 */
export class InMemoryProxyClient {
  private onMessageCallback: ((msg: unknown) => void) | null = null;
  private connected = false;

  /** Messages sent by the client (via request_rendezvous, etc.) */
  readonly sentMessages: unknown[] = [];

  async connect(onMessage: (msg: unknown) => void): Promise<void> {
    this.onMessageCallback = onMessage;
    this.connected = true;

    // Auto-respond with a fake auth challenge to complete connect()
    // The WASM client handles this internally, so we just resolve.
  }

  async request_rendezvous(): Promise<void> {
    this.sentMessages.push("GetRendevouz");
  }

  async request_identity(code: string): Promise<void> {
    this.sentMessages.push({ GetIdentity: code });
  }

  async send_to(fingerprint: string, data: Uint8Array): Promise<void> {
    this.sentMessages.push({ Send: { destination: fingerprint, payload: Array.from(data) } });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.onMessageCallback = null;
  }

  // ---------------------------------------------------------------------------
  // Test helpers
  // ---------------------------------------------------------------------------

  /** Inject a message as if the proxy server sent it. */
  injectMessage(msg: unknown): void {
    if (!this.onMessageCallback) {
      throw new Error("InMemoryProxyClient: not connected, cannot inject message");
    }
    this.onMessageCallback(msg);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
