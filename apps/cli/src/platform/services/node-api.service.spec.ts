import { isNoProxyHost } from "./node-api.service";

describe("isNoProxyHost", () => {
  const url = "https://api.bitwarden.com/accounts/prelogin";

  it("returns false when no_proxy is empty", () => {
    expect(isNoProxyHost(url, "")).toBe(false);
  });

  it("returns true for wildcard", () => {
    expect(isNoProxyHost(url, "*")).toBe(true);
  });

  it("matches exact hostname", () => {
    expect(isNoProxyHost(url, "api.bitwarden.com")).toBe(true);
  });

  it("matches parent domain suffix", () => {
    expect(isNoProxyHost(url, "bitwarden.com")).toBe(true);
    expect(isNoProxyHost(url, ".bitwarden.com")).toBe(true);
    expect(isNoProxyHost(url, "*.bitwarden.com")).toBe(true);
  });

  it("does not match unrelated hosts that share a suffix string", () => {
    expect(isNoProxyHost(url, "bitwarden.co")).toBe(false);
    expect(isNoProxyHost(url, "notbitwarden.com")).toBe(false);
  });

  it("honors port in entry", () => {
    expect(isNoProxyHost("https://localhost:8080/x", "localhost:8080")).toBe(true);
    expect(isNoProxyHost("https://localhost:9090/x", "localhost:8080")).toBe(false);
  });

  it("checks any entry in a comma-separated list", () => {
    expect(isNoProxyHost(url, "example.com, bitwarden.com ,other.net")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isNoProxyHost("not a url", "*")).toBe(true);
    expect(isNoProxyHost("not a url", "bitwarden.com")).toBe(false);
  });

  describe("environment precedence", () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env = { ...saved };
    });

    it("reads no_proxy when npm_config_no_proxy is unset", () => {
      delete process.env.npm_config_no_proxy;
      delete process.env.NPM_CONFIG_NO_PROXY;
      process.env.no_proxy = "bitwarden.com";
      expect(isNoProxyHost(url)).toBe(true);
    });

    it("prefers npm_config_no_proxy over no_proxy", () => {
      process.env.npm_config_no_proxy = "example.com";
      process.env.no_proxy = "bitwarden.com";
      expect(isNoProxyHost(url)).toBe(false);
    });
  });
});
