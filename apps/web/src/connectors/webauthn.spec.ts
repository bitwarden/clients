import { resolveWebauthnCallbackUri, mobileCallbackUri } from "./webauthn";

/**
 * Helper: builds a base64-encoded V2 data query param from a partial data object.
 * The `data` field inside the object must be a JSON string representing valid
 * webauthn options (with at minimum `challenge` and `allowCredentials`).
 */
function buildV2DataParam(overrides: Record<string, unknown> = {}): string {
  const webauthnOptions = JSON.stringify({
    challenge: "dGVzdC1jaGFsbGVuZ2U", // base64url of "test-challenge"
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

// ---------------------------------------------------------------------------
// Unit tests — pure function, no DOM or window mocking needed
// ---------------------------------------------------------------------------
describe("resolveWebauthnCallbackUri", () => {
  const fakeBuildDeeplink = () => "https://bitwarden.com/webauthn-callback";

  it("returns the deeplink builder result when deeplinkScheme is provided", () => {
    const result = resolveWebauthnCallbackUri("https", {}, fakeBuildDeeplink);
    expect(result).toBe("https://bitwarden.com/webauthn-callback");
  });

  it("returns the hardcoded mobileCallbackUri when mobile flag is true", () => {
    const result = resolveWebauthnCallbackUri(null, { mobile: true }, fakeBuildDeeplink);
    expect(result).toBe(mobileCallbackUri);
  });

  it("returns the hardcoded mobileCallbackUri when legacy callbackUri is present", () => {
    const result = resolveWebauthnCallbackUri(
      null,
      { callbackUri: "https://evil.example.com/steal" },
      fakeBuildDeeplink,
    );
    expect(result).toBe(mobileCallbackUri);
  });

  it("never uses the value of dataObj.callbackUri as the returned URI", () => {
    const maliciousUri = "https://evil.example.com/steal";
    const result = resolveWebauthnCallbackUri(
      null,
      { callbackUri: maliciousUri },
      fakeBuildDeeplink,
    );
    expect(result).not.toBe(maliciousUri);
    expect(result).toBe(mobileCallbackUri);
  });

  it("returns null when no mobile signals are present (web/iframe flow)", () => {
    const result = resolveWebauthnCallbackUri(null, {}, fakeBuildDeeplink);
    expect(result).toBeNull();
  });

  it("prioritizes deeplinkScheme over mobile flag", () => {
    const result = resolveWebauthnCallbackUri(
      "https",
      { mobile: true, callbackUri: "anything" },
      fakeBuildDeeplink,
    );
    expect(result).toBe("https://bitwarden.com/webauthn-callback");
  });

  it("prioritizes deeplinkScheme over legacy callbackUri", () => {
    const result = resolveWebauthnCallbackUri(
      "https",
      { callbackUri: "bitwarden://webauthn-callback" },
      fakeBuildDeeplink,
    );
    expect(result).toBe("https://bitwarden.com/webauthn-callback");
  });

  it("treats mobile flag false as non-mobile when no callbackUri present", () => {
    const result = resolveWebauthnCallbackUri(null, { mobile: false }, fakeBuildDeeplink);
    expect(result).toBeNull();
  });

  it("uses bitwarden:// scheme for non-https deeplinkScheme values", () => {
    const customBuilder = () => "bitwarden://webauthn-callback";
    const result = resolveWebauthnCallbackUri("bitwarden", {}, customBuilder);
    expect(result).toBe("bitwarden://webauthn-callback");
  });
});

// ---------------------------------------------------------------------------
// Integration tests — exercises the full connector flow with mocked DOM/browser
// ---------------------------------------------------------------------------
describe("webauthn connector integration", () => {
  let locationReplaceSpy: jest.SpyInstance;
  let originalLocation: Location;

  beforeEach(() => {
    // Provide the minimal DOM the connector expects
    document.body.innerHTML = `
      <h1 id="webauthn-header"></h1>
      <button id="webauthn-button"></button>
    `;

    originalLocation = window.location;

    // Spy on document.location.replace BEFORE redefining window.location.
    // In jsdom, document.location and window.location are initially the same
    // object, but Object.defineProperty on window.location only replaces the
    // window property — document.location still uses the original Location.
    locationReplaceSpy = jest.spyOn(document.location, "replace").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = "";
    jest.restoreAllMocks();
    jest.resetModules();
  });

  /**
   * Sets `window.location` so `getQsParam` reads the right href and
   * `appLinkHost` reads the right hostname.
   */
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

  /**
   * Provides a mock `navigator.credentials.get` that rejects, driving the
   * error flow which lets us assert on the callback URI used in the redirect.
   */
  function mockCredentialsReject(errorMessage = "user cancelled") {
    Object.defineProperty(navigator, "credentials", {
      value: { get: jest.fn().mockRejectedValue(new Error(errorMessage)) },
      configurable: true,
    });
  }

  /**
   * Imports the webauthn module fresh (resetting module-scoped state like
   * `parsed`, `callbackUri`, etc.) and triggers `init()`.
   * Returns a microtask flush so the credential promise rejection propagates.
   */
  async function initFreshModule(): Promise<void> {
    let initFn: () => void = () => {
      throw new Error("Module failed to load");
    };
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("./webauthn");
      initFn = mod.init;
    });
    initFn();
    // Flush the microtask queue so the rejected credentials promise settles
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("redirects to HTTPS callback when deeplinkScheme=https (new mobile client)", async () => {
    const data = buildV2DataParam();
    setWindowLocation(
      `https://vault.bitwarden.com/webauthn-connector?v=2&data=${data}&deeplinkScheme=https`,
    );
    mockCredentialsReject();

    await initFreshModule();

    expect(locationReplaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://bitwarden.com/webauthn-callback?error="),
    );
  });

  it("redirects to bitwarden:// callback when mobile=true (current mobile client)", async () => {
    const data = buildV2DataParam({ mobile: true });
    setWindowLocation(`https://vault.bitwarden.com/webauthn-connector?v=2&data=${data}`);
    mockCredentialsReject();

    await initFreshModule();

    expect(locationReplaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("bitwarden://webauthn-callback?error="),
    );
  });

  it("redirects to bitwarden:// callback when legacy callbackUri is present", async () => {
    const data = buildV2DataParam({ callbackUri: "https://should-be-ignored.example.com" });
    setWindowLocation(`https://vault.bitwarden.com/webauthn-connector?v=2&data=${data}`);
    mockCredentialsReject();

    await initFreshModule();

    expect(locationReplaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("bitwarden://webauthn-callback?error="),
    );
    // Verify the malicious callbackUri value was NOT used
    expect(locationReplaceSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should-be-ignored.example.com"),
    );
  });

  it("uses EU region host when vault is on bitwarden.eu", async () => {
    const data = buildV2DataParam();
    setWindowLocation(
      `https://vault.bitwarden.eu/webauthn-connector?v=2&data=${data}&deeplinkScheme=https`,
    );
    mockCredentialsReject();

    await initFreshModule();

    expect(locationReplaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://bitwarden.eu/webauthn-callback?error="),
    );
  });

  it("uses self-hosted region host when vault is on bitwarden.pw", async () => {
    const data = buildV2DataParam();
    setWindowLocation(
      `https://vault.bitwarden.pw/webauthn-connector?v=2&data=${data}&deeplinkScheme=https`,
    );
    mockCredentialsReject();

    await initFreshModule();

    expect(locationReplaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://bitwarden.pw/webauthn-callback?error="),
    );
  });
});
