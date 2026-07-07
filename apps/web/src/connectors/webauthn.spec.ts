/**
 * Tests for the WebAuthn connector (apps/web/src/connectors/webauthn.ts).
 *
 * The connector runs as a standalone page loaded in either:
 *   - An iframe (web vault) — communicates via postMessage
 *   - A mobile webview (ASWebAuthenticationSession) — communicates via deep-link redirect
 *
 * Each integration test uses jest.isolateModules to get fresh module-scoped state.
 * Redirect assertions use a mock of navigateToUrl (from common.ts) because jsdom's
 * Location.replace is non-configurable and cannot be intercepted directly.
 */

jest.mock("./common", () => {
  const actual = jest.requireActual("./common");
  return {
    ...actual,
    navigateToUrl: jest.fn(),
  };
});

/**
 * Builds a base64-encoded V2 data query param value.
 * The inner `data` field is a JSON string with minimal valid webauthn options.
 */
function buildV2DataParam(overrides: Record<string, unknown> = {}): string {
  const webauthnOptions = JSON.stringify({
    challenge: "dGVzdC1jaGFsbGVuZ2U",
    allowCredentials: [],
  });
  const dataObj = {
    data: webauthnOptions,
    headerText: "Test",
    btnText: "Authenticate",
    btnReturnText: "Return",
    ...overrides,
  };
  return btoa(JSON.stringify(dataObj));
}

describe("webauthn connector (main baseline)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1 id="webauthn-header"></h1>
      <button id="webauthn-button"></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function setWindowLocation(url: string) {
    const parsed = new URL(url);
    Object.defineProperty(window, "location", {
      value: {
        href: url,
        hostname: parsed.hostname,
        origin: parsed.origin,
      },
      writable: true,
      configurable: true,
    });
  }

  function mockCredentials(behavior: "reject" | "resolve") {
    const mockGet =
      behavior === "reject"
        ? jest.fn().mockRejectedValue(new Error("user cancelled"))
        : jest.fn().mockResolvedValue(mockPublicKeyCredential());
    Object.defineProperty(navigator, "credentials", {
      value: { get: mockGet },
      configurable: true,
    });
    return mockGet;
  }

  function mockPublicKeyCredential(): PublicKeyCredential {
    const buffer = new ArrayBuffer(8);
    return {
      id: "test-credential-id",
      rawId: buffer,
      type: "public-key",
      getClientExtensionResults: () => ({}),
      response: {
        authenticatorData: buffer,
        clientDataJSON: buffer,
        signature: buffer,
      },
      authenticatorAttachment: null,
    } as unknown as PublicKeyCredential;
  }

  /**
   * Imports a fresh webauthn module and calls init().
   * Returns the isolated module's navigateToUrl mock for redirect assertions.
   */
  async function initFreshModule(): Promise<jest.Mock> {
    let initFn!: () => void;
    let navigateMock!: jest.Mock;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const commonMod = require("./common");
      navigateMock = commonMod.navigateToUrl;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("./webauthn");
      initFn = mod.init;
    });
    initFn();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return navigateMock;
  }

  // -----------------------------------------------------------------------
  // Mobile flow: V2 with callbackUri in data
  // -----------------------------------------------------------------------
  describe("mobile flow with callbackUri in data", () => {
    it("redirects to hardcoded mobileCallbackUri on success, not dataObj.callbackUri", async () => {
      const data = buildV2DataParam({
        callbackUri: "https://evil.example.com/steal",
      });
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      // mobileResponse blocks auto-execute; simulate user tapping the button
      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("bitwarden://webauthn-callback?data="),
      );
      // Must never use the client-supplied callbackUri value
      expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining("evil.example.com"));
    });

    it("redirects to mobileCallbackUri on error (invalid webauthn data)", async () => {
      const data = buildV2DataParam({
        callbackUri: "bitwarden://webauthn-callback",
        data: "not-valid-json",
      });
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("bitwarden://webauthn-callback?error="),
      );
    });

    it("does not auto-execute WebAuthn (mobile blocks non-user-initiated requests)", async () => {
      const data = buildV2DataParam({
        callbackUri: "bitwarden://webauthn-callback",
      });
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      const credentialGet = mockCredentials("resolve");

      await initFreshModule();

      // mobileResponse=true should block auto-execute
      expect(credentialGet).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Mobile flow: V2 with mobile flag
  // -----------------------------------------------------------------------
  describe("mobile flow with mobile: true", () => {
    it("does not auto-execute WebAuthn", async () => {
      const data = buildV2DataParam({ mobile: true });
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      const credentialGet = mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      expect(credentialGet).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Iframe flow: V2 without mobile signals
  // -----------------------------------------------------------------------
  describe("iframe flow (no mobile signals)", () => {
    it("posts success message to parent", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      const navigateMock = await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("success|"),
        "https://vault.bitwarden.com",
      );
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("posts error message to parent on credential failure", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("reject");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("error|"),
        "https://vault.bitwarden.com",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Missing parent parameter
  // -----------------------------------------------------------------------
  describe("missing parent parameter", () => {
    it("does not redirect when no parent and no mobile signals", async () => {
      const data = buildV2DataParam({});
      setWindowLocation(`https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}`);
      mockCredentials("resolve");
      jest.spyOn(window.parent, "postMessage").mockImplementation(() => {});

      const navigateMock = await initFreshModule();

      // No callbackUri and no parentUrl — no redirect target
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("proceeds with mobile flow when callbackUri is present but parent is absent", async () => {
      const data = buildV2DataParam({ callbackUri: "bitwarden://webauthn-callback" });
      setWindowLocation(`https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}`);
      const credentialGet = mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      // mobileResponse blocks auto-execute; user taps button
      expect(credentialGet).not.toHaveBeenCalled();

      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("bitwarden://webauthn-callback?data="),
      );
    });
  });

  // -----------------------------------------------------------------------
  // deeplinkScheme feature: HTTPS universal links for mobile
  // -----------------------------------------------------------------------
  describe("deeplinkScheme=https (new mobile client)", () => {
    it("redirects to HTTPS callback on bitwarden.com", async () => {
      const data = buildV2DataParam({});
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      // mobileResponse blocks auto-execute; simulate tap
      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("https://bitwarden.com/webauthn-callback?data="),
      );
    });

    it("redirects to HTTPS callback on bitwarden.eu", async () => {
      const data = buildV2DataParam({});
      setWindowLocation(
        `https://vault.bitwarden.eu/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("https://bitwarden.eu/webauthn-callback?data="),
      );
    });

    it("redirects to HTTPS callback on bitwarden.pw", async () => {
      const data = buildV2DataParam({});
      setWindowLocation(
        `https://vault.bitwarden.pw/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("https://bitwarden.pw/webauthn-callback?data="),
      );
    });

    it("redirects to error on HTTPS callback when webauthn data is invalid", async () => {
      const data = buildV2DataParam({ data: "not-valid-json" });
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("https://bitwarden.com/webauthn-callback?error="),
      );
    });

    it("blocks auto-execute for mobile", async () => {
      const data = buildV2DataParam({});
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      const credentialGet = mockCredentials("resolve");

      await initFreshModule();

      expect(credentialGet).not.toHaveBeenCalled();
    });

    it("prioritizes deeplinkScheme over legacy callbackUri", async () => {
      const data = buildV2DataParam({
        callbackUri: "bitwarden://webauthn-callback",
        mobile: true,
      });
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&deeplinkScheme=https`,
      );
      mockCredentials("resolve");

      const navigateMock = await initFreshModule();

      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should use HTTPS, not bitwarden://
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("https://bitwarden.com/webauthn-callback?data="),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Context-aware postMessage targetOrigin (PM-32091)
// ---------------------------------------------------------------------------
describe("context-aware postMessage targetOrigin", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1 id="webauthn-header"></h1>
      <button id="webauthn-button"></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function setWindowLocation(url: string) {
    const parsed = new URL(url);
    Object.defineProperty(window, "location", {
      value: {
        href: url,
        hostname: parsed.hostname,
        origin: parsed.origin,
      },
      writable: true,
      configurable: true,
    });
  }

  function mockCredentials(behavior: "reject" | "resolve") {
    const mockGet =
      behavior === "reject"
        ? jest.fn().mockRejectedValue(new Error("user cancelled"))
        : jest.fn().mockResolvedValue(mockPublicKeyCredential());
    Object.defineProperty(navigator, "credentials", {
      value: { get: mockGet },
      configurable: true,
    });
    return mockGet;
  }

  function mockPublicKeyCredential(): PublicKeyCredential {
    const buffer = new ArrayBuffer(8);
    return {
      id: "test-credential-id",
      rawId: buffer,
      type: "public-key",
      getClientExtensionResults: () => ({}),
      response: {
        authenticatorData: buffer,
        clientDataJSON: buffer,
        signature: buffer,
      },
      authenticatorAttachment: null,
    } as unknown as PublicKeyCredential;
  }

  async function initFreshModule(): Promise<jest.Mock> {
    let initFn!: () => void;
    let navigateMock!: jest.Mock;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const commonMod = require("./common");
      navigateMock = commonMod.navigateToUrl;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("./webauthn");
      initFn = mod.init;
    });
    initFn();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return navigateMock;
  }

  describe("on Bitwarden-managed domains", () => {
    it("sends postMessage using the connector's own origin", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://unrelated.example.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("success|"),
        "https://vault.bitwarden.com",
      );
    });

    it("sends error messages using the connector's own origin", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://unrelated.example.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("reject");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("error|"),
        "https://vault.bitwarden.com",
      );
    });

    it("sends info messages using the connector's own origin", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://unrelated.example.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith("info|ready", "https://vault.bitwarden.com");
    });
  });

  describe("on self-hosted / unmanaged domains", () => {
    it("sends success postMessage to parentUrl", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.customer.com");
      setWindowLocation(
        `https://vault.customer.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("success|"),
        "https://vault.customer.com",
      );
    });

    it("sends error postMessage to parentUrl", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.customer.com");
      setWindowLocation(
        `https://vault.customer.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("reject");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("error|"),
        "https://vault.customer.com",
      );
    });

    it("accepts stop messages from the parent origin", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.customer.com");
      setWindowLocation(
        `https://vault.customer.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");

      await initFreshModule();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: "stop",
          origin: "https://vault.customer.com",
        }),
      );

      const credGet = mockCredentials("resolve");
      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // stopWebAuthn was set, button click returns early
      expect(credGet).not.toHaveBeenCalled();
    });
  });

  describe("desktop compatibility (file:// parent)", () => {
    it("preserves file:// parent URL as the postMessage target", async () => {
      const data = buildV2DataParam({});
      const fileParent = encodeURIComponent("file:///path/to/electron/index.html");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${fileParent}`,
      );
      mockCredentials("resolve");
      const postMessageSpy = jest.spyOn(window.parent, "postMessage");

      await initFreshModule();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("success|"),
        "file:///path/to/electron/index.html",
      );
    });
  });

  describe("incoming message validation", () => {
    it("rejects messages from a non-matching origin on managed domains", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");

      await initFreshModule();

      // Dispatch a "stop" message from a different origin
      const event = new MessageEvent("message", {
        data: "stop",
        origin: "https://unrelated.example.com",
      });
      window.dispatchEvent(event);

      // If the message was accepted, clicking the button would not trigger WebAuthn
      // (because stopWebAuthn would be true). Verify it was rejected by clicking
      // and confirming credentials.get was called again.
      const credGet = mockCredentials("resolve");
      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(credGet).toHaveBeenCalled();
    });

    it("accepts messages from the connector's own origin on managed domains", async () => {
      const data = buildV2DataParam({});
      const parentUrl = encodeURIComponent("https://vault.bitwarden.com");
      setWindowLocation(
        `https://vault.bitwarden.com/webauthn-connector.html?v=2&data=${data}&parent=${parentUrl}`,
      );
      mockCredentials("resolve");

      await initFreshModule();

      // Dispatch a "stop" message from the same origin
      const event = new MessageEvent("message", {
        data: "stop",
        origin: "https://vault.bitwarden.com",
      });
      window.dispatchEvent(event);

      // If the message was accepted, stopWebAuthn is true and the button resets.
      // Clicking it should NOT call credentials.get (it returns early).
      const credGet = mockCredentials("resolve");
      document.getElementById("webauthn-button")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(credGet).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests — resolveWebauthnCallbackUri (pure function, no DOM needed)
// ---------------------------------------------------------------------------
import { resolveWebauthnCallbackUri } from "./webauthn";

describe("resolveWebauthnCallbackUri", () => {
  const fakeBuildDeeplink = () => "https://bitwarden.com/webauthn-callback";

  it("returns the deeplink builder result when deeplinkScheme is provided", () => {
    const result = resolveWebauthnCallbackUri("https", {}, fakeBuildDeeplink);
    expect(result).toBe("https://bitwarden.com/webauthn-callback");
  });

  it("returns bitwarden:// when mobile flag is true", () => {
    const result = resolveWebauthnCallbackUri(null, { mobile: true }, fakeBuildDeeplink);
    expect(result).toBe("bitwarden://webauthn-callback");
  });

  it("returns bitwarden:// when legacy callbackUri is present", () => {
    const result = resolveWebauthnCallbackUri(
      null,
      { callbackUri: "https://evil.example.com" },
      fakeBuildDeeplink,
    );
    expect(result).toBe("bitwarden://webauthn-callback");
  });

  it("never uses the value of dataObj.callbackUri as the returned URI", () => {
    const malicious = "https://evil.example.com/steal";
    const result = resolveWebauthnCallbackUri(null, { callbackUri: malicious }, fakeBuildDeeplink);
    expect(result).not.toBe(malicious);
    expect(result).toBe("bitwarden://webauthn-callback");
  });

  it("returns null when no mobile signals are present", () => {
    const result = resolveWebauthnCallbackUri(null, {}, fakeBuildDeeplink);
    expect(result).toBeNull();
  });

  it("prioritizes deeplinkScheme over mobile flag and callbackUri", () => {
    const result = resolveWebauthnCallbackUri(
      "https",
      { mobile: true, callbackUri: "anything" },
      fakeBuildDeeplink,
    );
    expect(result).toBe("https://bitwarden.com/webauthn-callback");
  });

  it("treats mobile: false as non-mobile when no callbackUri present", () => {
    const result = resolveWebauthnCallbackUri(null, { mobile: false }, fakeBuildDeeplink);
    expect(result).toBeNull();
  });
});
