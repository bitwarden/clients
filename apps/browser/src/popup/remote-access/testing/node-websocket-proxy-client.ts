import WebSocket from "ws";

interface ProxyMessage {
  AuthChallenge?: number[];
  [key: string]: unknown;
}

/**
 * Node.js WebSocket-based proxy client for E2E testing.
 *
 * Uses the `ws` package instead of the browser WebSocket API.
 * Accepts a `signChallengeFn` directly instead of dynamic SDK import.
 */
export class NodeWebSocketProxyClient {
  private ws: WebSocket | null = null;
  private onMessageCallback: ((msg: unknown) => void) | null = null;
  private authenticated = false;

  constructor(
    private proxyUrl: string,
    private identityCose: Uint8Array,
    private signChallengeFn: (identityCose: number[], challengeJson: string) => string,
  ) {}

  async connect(onMessage: (msg: unknown) => void): Promise<void> {
    this.onMessageCallback = onMessage;

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.proxyUrl);

      this.ws.on("message", (data: WebSocket.Data) => {
        const str = typeof data === "string" ? data : data.toString();
        const msg: ProxyMessage = JSON.parse(str);
        this.handleMessage(msg, resolve, reject);
      });

      this.ws.on("error", (err: Error) => {
        if (!this.authenticated) {
          reject(new Error(`WebSocket connection error: ${err.message}`));
        }
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        if (!this.authenticated) {
          reject(new Error(`WebSocket closed before auth: ${code} ${reason.toString()}`));
        }
        this.ws = null;
      });
    });
  }

  async request_rendezvous(): Promise<void> {
    this.send(JSON.stringify("GetRendevouz"));
  }

  async request_identity(code: string): Promise<void> {
    this.send(JSON.stringify({ GetIdentity: code }));
  }

  async send_to(fingerprint: string, data: Uint8Array): Promise<void> {
    const bytes: number[] = [];
    for (let i = 0; i < fingerprint.length; i += 2) {
      bytes.push(parseInt(fingerprint.substring(i, i + 2), 16));
    }
    this.send(
      JSON.stringify({
        Send: { destination: bytes, payload: Array.from(data) },
      }),
    );
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
  }

  private handleMessage(
    msg: ProxyMessage,
    resolveConnect: () => void,
    rejectConnect: (err: Error) => void,
  ): void {
    if (msg.AuthChallenge != null && !this.authenticated) {
      try {
        const challengeJson = JSON.stringify(msg);
        const responseJson = this.signChallengeFn(Array.from(this.identityCose), challengeJson);
        this.ws?.send(responseJson);
        this.authenticated = true;
        resolveConnect();
      } catch (e) {
        rejectConnect(new Error(`Auth challenge failed: ${e}`));
      }
      return;
    }

    this.onMessageCallback?.(msg);
  }

  private send(json: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(json);
  }
}
