import { BrowserProxyClient, ProxyMessage } from "./rat-proxy-client";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WsHandler = (event: any) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: WsHandler | null = null;
  onmessage: WsHandler | null = null;
  onerror: WsHandler | null = null;
  onclose: WsHandler | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: "" } as any);
  }

  // Test helpers
  simulateMessage(msg: ProxyMessage): void {
    this.onmessage?.({ data: JSON.stringify(msg) } as any);
  }

  simulateError(): void {
    this.onerror?.({} as any);
  }

  simulateClose(code = 1006, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as any);
  }
}

// Mock the SDK import used inside connect()
jest.mock("@bitwarden/sdk-internal", () => ({
  UserClient: {
    sign_proxy_challenge: (identityCose: number[], challengeJson: string) => {
      // Return a deterministic "signed" response
      return JSON.stringify({ AuthResponse: [identityCose, challengeJson] });
    },
  },
}));

/** Flush microtask queue so the dynamic import() in connect() resolves. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("BrowserProxyClient", () => {
  let client: BrowserProxyClient;
  const proxyUrl = "ws://test:8080";
  const identityCose = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    MockWebSocket.instances = [];
    client = new BrowserProxyClient(
      proxyUrl,
      identityCose,
      MockWebSocket as unknown as { new (url: string): WebSocket },
    );
  });

  function latestWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  /** Start connect and wait for the WebSocket to be created (after dynamic import resolves). */
  async function connectAndGetWs(
    onMessage: (msg: unknown) => void = jest.fn(),
  ): Promise<{ connectPromise: Promise<void>; ws: MockWebSocket }> {
    const connectPromise = client.connect(onMessage);
    await flushMicrotasks();
    const ws = latestWs();
    return { connectPromise, ws };
  }

  // ---------------------------------------------------------------------------
  // Auth challenge flow
  // ---------------------------------------------------------------------------

  it("should connect and authenticate on AuthChallenge", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);

    expect(ws.url).toBe(proxyUrl);

    // Simulate auth challenge
    ws.simulateMessage({ AuthChallenge: [10, 20, 30] });

    await connectPromise;

    // Should have sent the signed response
    expect(ws.sent).toHaveLength(1);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent.AuthResponse).toBeDefined();
  });

  it("should reject connect on auth challenge failure", async () => {
    // Override mock to throw
    const sdk = jest.requireMock("@bitwarden/sdk-internal");
    const original = sdk.UserClient.sign_proxy_challenge;
    sdk.UserClient.sign_proxy_challenge = () => {
      throw new Error("sign failed");
    };

    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateMessage({ AuthChallenge: [10, 20, 30] });

    await expect(connectPromise).rejects.toThrow("Auth challenge failed");

    sdk.UserClient.sign_proxy_challenge = original;
  });

  // ---------------------------------------------------------------------------
  // Message dispatch after auth
  // ---------------------------------------------------------------------------

  it("should dispatch rendezvous info to onMessage callback", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    ws.simulateMessage({ RendevouzInfo: { code: "ABC123" } });

    expect(onMessage).toHaveBeenCalledWith({
      type: "rendezvous_info",
      code: "ABC123",
    });
  });

  it("should dispatch identity info with serialized fingerprint", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    ws.simulateMessage({
      IdentityInfo: { fingerprint: [0xab, 0xcd, 0xef] as any, identity: { key: "val" } },
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: "identity_info",
      fingerprint: "abcdef",
      identity: { key: "val" },
    });
  });

  it("should dispatch Send messages with serialized fingerprints", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    ws.simulateMessage({
      Send: {
        source: [0x01, 0x02],
        destination: [0x03, 0x04],
        payload: [10, 20],
      },
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: "send",
      source: "0102",
      destination: "0304",
      payload: [10, 20],
    });
  });

  // ---------------------------------------------------------------------------
  // request_rendezvous / request_identity / send_to
  // ---------------------------------------------------------------------------

  it("should send GetRendevouz command", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    await client.request_rendezvous();
    expect(ws.sent[ws.sent.length - 1]).toBe(JSON.stringify("GetRendevouz"));
  });

  it("should send GetIdentity command with code", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    await client.request_identity("ABC");
    expect(JSON.parse(ws.sent[ws.sent.length - 1])).toEqual({ GetIdentity: "ABC" });
  });

  it("should send Send command with hex-decoded destination", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    await client.send_to("abcd", new Uint8Array([99]));
    const parsed = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(parsed.Send.destination).toEqual([0xab, 0xcd]);
    expect(parsed.Send.payload).toEqual([99]);
  });

  // ---------------------------------------------------------------------------
  // Error and disconnect
  // ---------------------------------------------------------------------------

  it("should reject on WebSocket error before auth", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateError();

    await expect(connectPromise).rejects.toThrow("WebSocket connection error");
  });

  it("should reject on WebSocket close before auth", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateClose(1006, "gone");

    await expect(connectPromise).rejects.toThrow("WebSocket closed before auth");
  });

  it("should throw when sending on closed socket", async () => {
    // Don't connect — ws is null
    await expect(client.request_rendezvous()).rejects.toThrow("WebSocket not connected");
  });

  it("should disconnect cleanly", async () => {
    const { connectPromise, ws } = await connectAndGetWs();
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    await client.disconnect();

    // Should throw now
    await expect(client.request_rendezvous()).rejects.toThrow("WebSocket not connected");
  });

  // ---------------------------------------------------------------------------
  // Fingerprint serialization edge cases
  // ---------------------------------------------------------------------------

  it("should pass through string fingerprints unchanged", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    ws.simulateMessage({
      IdentityInfo: { fingerprint: "already-a-string", identity: null },
    });

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: "already-a-string" }),
    );
  });

  it("should return empty string for non-array/non-string fingerprints", async () => {
    const onMessage = jest.fn();
    const { connectPromise, ws } = await connectAndGetWs(onMessage);
    ws.simulateMessage({ AuthChallenge: [1] });
    await connectPromise;

    ws.simulateMessage({
      Send: { source: 12345, destination: null, payload: [] },
    });

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ source: "", destination: "" }),
    );
  });
});
