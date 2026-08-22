import { ClientType } from "@bitwarden/common/enums";

import { DESKTOP_SSO_CALLBACK, SsoUrlService } from "./sso-url.service";

describe("SsoUrlService", () => {
  let service: SsoUrlService;

  beforeEach(() => {
    service = new SsoUrlService();
  });

  it("should build Desktop SSO URL correctly", () => {
    const baseUrl = "https://web-vault.bitwarden.com";
    const clientType = ClientType.Desktop;
    const redirectUri = DESKTOP_SSO_CALLBACK;
    const state = "abc123";
    const codeChallenge = "xyz789";
    const email = "test@bitwarden.com";

    const expectedUrl = `${baseUrl}/#/sso?clientId=desktop&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

    const result = service.buildSsoUrl(
      baseUrl,
      clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
    );
    expect(result).toBe(expectedUrl);
  });

  it("should build Desktop localhost callback SSO URL correctly", () => {
    const baseUrl = "https://web-vault.bitwarden.com";
    const clientType = ClientType.Desktop;
    const redirectUri = `https://localhost:1000`;
    const state = "abc123";
    const codeChallenge = "xyz789";
    const email = "test@bitwarden.com";

    const expectedUrl = `${baseUrl}/#/sso?clientId=desktop&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

    const result = service.buildSsoUrl(
      baseUrl,
      clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
    );
    expect(result).toBe(expectedUrl);
  });

  it("should build Extension SSO URL correctly", () => {
    const baseUrl = "https://web-vault.bitwarden.com";
    const clientType = ClientType.Browser;
    const redirectUri = baseUrl + "/sso-connector.html";
    const state = "abc123";
    const codeChallenge = "xyz789";
    const email = "test@bitwarden.com";

    const expectedUrl = `${baseUrl}/#/sso?clientId=browser&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

    const result = service.buildSsoUrl(
      baseUrl,
      clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
    );
    expect(result).toBe(expectedUrl);
  });

  it("should build CLI SSO URL correctly", () => {
    const baseUrl = "https://web-vault.bitwarden.com";
    const clientType = ClientType.Cli;
    const redirectUri = "https://localhost:1000";
    const state = "abc123";
    const codeChallenge = "xyz789";
    const email = "test@bitwarden.com";

    const expectedUrl = `${baseUrl}/#/sso?clientId=cli&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

    const result = service.buildSsoUrl(
      baseUrl,
      clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
    );
    expect(result).toBe(expectedUrl);
  });

  it("should build CLI SSO URL with Org SSO Identifier correctly", () => {
    const baseUrl = "https://web-vault.bitwarden.com";
    const clientType = ClientType.Cli;
    const redirectUri = "https://localhost:1000";
    const state = "abc123";
    const codeChallenge = "xyz789";
    const email = "test@bitwarden.com";
    const orgSsoIdentifier = "test-org";

    const expectedUrl = `${baseUrl}/#/sso?clientId=cli&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}&identifier=${encodeURIComponent(orgSsoIdentifier)}`;

    const result = service.buildSsoUrl(
      baseUrl,
      clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
      orgSsoIdentifier,
    );
    expect(result).toBe(expectedUrl);
  });

  describe("buildSsoLaunchConnectorUrl", () => {
    it("targets the sso-launch-connector.html page with the same query params as buildSsoUrl", () => {
      const baseUrl = "https://web-vault.bitwarden.com";
      const clientType = ClientType.Desktop;
      const redirectUri = DESKTOP_SSO_CALLBACK;
      const state = "abc123";
      const codeChallenge = "xyz789";
      const email = "test@bitwarden.com";

      const expectedUrl = `${baseUrl}/sso-launch-connector.html?clientId=desktop&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

      const result = service.buildSsoLaunchConnectorUrl(
        baseUrl,
        clientType,
        redirectUri,
        state,
        codeChallenge,
        email,
      );
      expect(result).toBe(expectedUrl);
    });

    it("includes the Org SSO Identifier when provided", () => {
      const baseUrl = "https://web-vault.bitwarden.com";
      const clientType = ClientType.Desktop;
      const redirectUri = DESKTOP_SSO_CALLBACK;
      const state = "abc123";
      const codeChallenge = "xyz789";
      const email = "test@bitwarden.com";
      const orgSsoIdentifier = "test-org";

      const expectedUrl = `${baseUrl}/sso-launch-connector.html?clientId=desktop&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}&identifier=${encodeURIComponent(orgSsoIdentifier)}`;

      const result = service.buildSsoLaunchConnectorUrl(
        baseUrl,
        clientType,
        redirectUri,
        state,
        codeChallenge,
        email,
        orgSsoIdentifier,
      );
      expect(result).toBe(expectedUrl);
    });

    it("only differs from buildSsoUrl by the path (fragment route vs connector page)", () => {
      const baseUrl = "https://web-vault.bitwarden.com";
      const args = [
        baseUrl,
        ClientType.Desktop,
        DESKTOP_SSO_CALLBACK,
        "abc123",
        "xyz789",
        "test@bitwarden.com",
        "test-org",
      ] as const;

      const direct = service.buildSsoUrl(...args);
      const connector = service.buildSsoLaunchConnectorUrl(...args);

      expect(direct.replace("/#/sso?", "/sso-launch-connector.html?")).toBe(connector);
    });
  });
});
