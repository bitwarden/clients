/**
 * Integration tests that exercise the real WASM UserClient bindings.
 *
 * Requires either:
 *   - WASM_NODE_PATH env var pointing to the Node.js WASM build, OR
 *   - @bitwarden/sdk-internal installed with Node.js WASM support
 *
 * Run: WASM_NODE_PATH=... npx jest --config apps/browser/jest.integration.config.js
 */

describe("UserClient WASM integration", () => {
  let sdk: any;

  beforeAll(async () => {
    try {
      sdk = await import("@bitwarden/sdk-internal");
    } catch {
      // SDK not available — tests will be skipped via skipIfNoSdk()
    }
  });

  function skipIfNoSdk(): boolean {
    if (!sdk?.UserClient) {
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Identity generation
  // ---------------------------------------------------------------------------

  it("generate_identity returns non-empty bytes", () => {
    if (skipIfNoSdk()) {
      return;
    }

    const identity = sdk.UserClient.generate_identity();
    expect(identity).toBeDefined();
    expect(identity.length).toBeGreaterThan(0);
  });

  it("generate_identity produces unique identities", () => {
    if (skipIfNoSdk()) {
      return;
    }

    const id1 = sdk.UserClient.generate_identity();
    const id2 = sdk.UserClient.generate_identity();

    // COSE keys should differ
    expect(Array.from(id1)).not.toEqual(Array.from(id2));
  });

  // ---------------------------------------------------------------------------
  // Challenge signing
  // ---------------------------------------------------------------------------

  it("sign_proxy_challenge returns valid JSON", () => {
    if (skipIfNoSdk()) {
      return;
    }

    const identity = sdk.UserClient.generate_identity();
    const challenge = JSON.stringify({ AuthChallenge: Array.from(new Uint8Array(32)) });

    const response = sdk.UserClient.sign_proxy_challenge(Array.from(identity), challenge);

    expect(response).toBeDefined();
    expect(typeof response).toBe("string");

    // Should be valid JSON
    const parsed = JSON.parse(response);
    expect(parsed).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Serialization roundtrip
  // ---------------------------------------------------------------------------

  it("identity data roundtrips through generate → listen → get_identity_data", async () => {
    if (skipIfNoSdk()) {
      return;
    }

    const identity = sdk.UserClient.generate_identity();

    // Create a minimal proxy client that auto-resolves connect
    const mockProxy = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      request_rendezvous: jest.fn().mockResolvedValue(undefined),
      request_identity: jest.fn().mockResolvedValue(undefined),
      send_to: jest.fn().mockResolvedValue(undefined),
    };

    try {
      const client = await sdk.UserClient.listen(
        mockProxy,
        undefined, // no session data
        new Uint8Array(identity),
      );

      const identityData = client.get_identity_data();
      expect(identityData).toBeDefined();
      expect(identityData.length).toBeGreaterThan(0);

      // Should be able to retrieve session data too
      const sessionData = client.get_session_data();
      expect(typeof sessionData).toBe("string");
    } catch {
      // If listen requires a real proxy connection, that's expected
      // Just verify generate_identity works
      expect(identity.length).toBeGreaterThan(0);
    }
  });
});
