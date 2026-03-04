/**
 * Browser implementation of the RatProxyClient interface.
 *
 * Manages a WebSocket connection to the bw-proxy relay server.
 * Uses the WASM `RatUserClient.sign_proxy_challenge()` helper
 * for the auth challenge-response (crypto stays in Rust).
 */

interface ProxyMessage {
  AuthChallenge?: number[];
  AuthResponse?: [unknown, unknown];
  GetRendevouz?: null;
  RendevouzInfo?: { code: string };
  GetIdentity?: string;
  IdentityInfo?: { fingerprint: string; identity: unknown };
  Send?: { source?: unknown; destination: unknown; payload: number[] };
}

export class BrowserRatProxyClient {
  private ws: WebSocket | null = null;
  private onMessageCallback: ((msg: unknown) => void) | null = null;
  private authenticated = false;
  private signChallengeFn: ((identityCose: number[], challengeJson: string) => string) | null =
    null;

  constructor(
    private proxyUrl: string,
    private identityCose: Uint8Array,
  ) {}

  async connect(onMessage: (msg: unknown) => void): Promise<void> {
    this.onMessageCallback = onMessage;

    // Pre-load the SDK sign function so we can use it synchronously in onmessage.
    // The sign_proxy_challenge static method is added by our WASM bindings but may
    // not be in the pre-built TS types yet — cast through any.
    const sdk: any = await import("@bitwarden/sdk-internal");
    this.signChallengeFn = (identityCose: number[], challengeJson: string) =>
      sdk.RatUserClient.sign_proxy_challenge(identityCose, challengeJson) as string;

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.proxyUrl);

      this.ws.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : "";
        const msg: ProxyMessage = JSON.parse(data);
        this.handleMessage(msg, resolve, reject);
      };

      this.ws.onerror = () => {
        if (!this.authenticated) {
          reject(new Error("WebSocket connection error"));
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        if (!this.authenticated) {
          reject(new Error(`WebSocket closed before auth: ${event.code} ${event.reason}`));
        }
        this.ws = null;
      };
    });
  }

  async request_rendezvous(): Promise<void> {
    this.send(JSON.stringify("GetRendevouz"));
  }

  async request_identity(code: string): Promise<void> {
    this.send(JSON.stringify({ GetIdentity: code }));
  }

  async send_to(fingerprint: string, data: Uint8Array): Promise<void> {
    this.send(
      JSON.stringify({
        Send: {
          destination: this.hexToFingerprintJson(fingerprint),
          payload: Array.from(data),
        },
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
        const responseJson = this.signChallengeFn!(Array.from(this.identityCose), challengeJson);
        this.ws?.send(responseJson);
        this.authenticated = true;
        resolveConnect();
      } catch (e) {
        rejectConnect(new Error(`Auth challenge failed: ${e}`));
      }
      return;
    }

    if (!this.onMessageCallback) {
      return;
    }

    if (msg.RendevouzInfo != null) {
      const info = msg.RendevouzInfo;
      this.onMessageCallback({
        type: "rendezvous_info",
        code: typeof info === "object" ? info.code : info,
      });
    } else if (msg.IdentityInfo != null) {
      this.onMessageCallback({
        type: "identity_info",
        fingerprint: this.serializeFingerprint(msg.IdentityInfo.fingerprint),
        identity: msg.IdentityInfo.identity,
      });
    } else if (msg.Send != null) {
      this.onMessageCallback({
        type: "send",
        source: this.serializeFingerprint(msg.Send.source),
        destination: this.serializeFingerprint(msg.Send.destination),
        payload: msg.Send.payload,
      });
    }
  }

  private send(json: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(json);
  }

  /** Convert a hex fingerprint string to the JSON representation bw-proxy expects. */
  private hexToFingerprintJson(hex: string): unknown {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
  }

  /** Serialize a fingerprint from the proxy wire format to a hex string. */
  private serializeFingerprint(fp: unknown): string {
    if (typeof fp === "string") {
      return fp;
    }
    if (Array.isArray(fp)) {
      return fp.map((b: number) => b.toString(16).padStart(2, "0")).join("");
    }
    return "";
  }
}
