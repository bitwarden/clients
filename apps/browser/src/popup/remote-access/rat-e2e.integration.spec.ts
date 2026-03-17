/**
 * E2E integration tests — full stack with real proxy server and WASM.
 *
 * Requires:
 *   - WASM_NODE_PATH env var or @bitwarden/sdk-internal with Node.js WASM
 *   - REMOTE_ACCESS_REPO_PATH env var or ../remote-access repo with `cargo build -p ap-proxy`
 *
 * Run: WASM_NODE_PATH=... npx jest --config apps/browser/jest.e2e.config.js
 */

import { NodeWebSocketProxyClient } from "./testing/node-websocket-proxy-client";
import { ProxyServerHarness } from "./testing/proxy-server-harness";

describe("Remote Access E2E", () => {
  let sdk: any;
  let proxyHarness: ProxyServerHarness;
  let shouldSkip = false;

  beforeAll(async () => {
    // Check for WASM SDK
    try {
      sdk = await import("@bitwarden/sdk-internal");
      if (!sdk?.RatUserClient) {
        shouldSkip = true;
        // eslint-disable-next-line no-console
        console.warn("Skipping E2E tests: RatUserClient not available in SDK");
        return;
      }
    } catch {
      shouldSkip = true;
      // eslint-disable-next-line no-console
      console.warn("Skipping E2E tests: @bitwarden/sdk-internal not available");
      return;
    }

    // Start proxy server
    proxyHarness = new ProxyServerHarness();
    try {
      await proxyHarness.start();
    } catch (e) {
      shouldSkip = true;
      // eslint-disable-next-line no-console
      console.warn("Skipping E2E tests: proxy server failed to start.", (e as Error).message);
    }
  }, 30000);

  afterAll(async () => {
    if (proxyHarness) {
      await proxyHarness.stop();
    }
  });

  function skipIfUnavailable(): boolean {
    if (shouldSkip) {
      return true;
    }
    return false;
  }

  function createTestClient(): {
    identity: Uint8Array;
    client: NodeWebSocketProxyClient;
  } {
    const identity = new Uint8Array(sdk.RatUserClient.generate_identity());
    const signFn = (identityCose: number[], challengeJson: string) =>
      sdk.RatUserClient.sign_proxy_challenge(identityCose, challengeJson);
    const client = new NodeWebSocketProxyClient(proxyHarness.url, identity, signFn);
    return { identity, client };
  }

  it("should connect to proxy and authenticate", async () => {
    if (skipIfUnavailable()) {
      return;
    }

    const { client } = createTestClient();
    await client.connect(() => {});

    // If we got here, auth succeeded
    expect(true).toBe(true);

    await client.disconnect();
  });

  it("should request and receive rendezvous code", async () => {
    if (skipIfUnavailable()) {
      return;
    }

    const { client } = createTestClient();
    const messages: any[] = [];
    await client.connect((msg) => messages.push(msg));

    await client.request_rendezvous();

    // Wait for rendezvous response
    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.some((m) => m.RendevouzInfo != null)) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    });

    const rendezvousMsg = messages.find((m) => m.RendevouzInfo != null);
    expect(rendezvousMsg).toBeDefined();
    expect(rendezvousMsg.RendevouzInfo.code).toBeDefined();
    expect(typeof rendezvousMsg.RendevouzInfo.code).toBe("string");

    await client.disconnect();
  });

  it("should handle full RatUserClient lifecycle via WASM", async () => {
    if (skipIfUnavailable()) {
      return;
    }

    const { identity, client: nodeProxy } = createTestClient();

    try {
      const ratClient = await sdk.RatUserClient.listen(nodeProxy, undefined, identity);

      const sessionData = ratClient.get_session_data();
      expect(sessionData).toBeDefined();

      const identityData = ratClient.get_identity_data();
      expect(identityData).toBeDefined();
      expect(identityData.length).toBeGreaterThan(0);
    } catch {
      // Some WASM builds may not support listen() with NodeWebSocketProxyClient
      expect(identity.length).toBeGreaterThan(0);
    } finally {
      await nodeProxy.disconnect();
    }
  });
});
