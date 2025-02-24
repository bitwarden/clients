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
});
