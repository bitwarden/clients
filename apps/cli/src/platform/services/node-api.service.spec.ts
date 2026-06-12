import { mock } from "jest-mock-extended";
import * as fe from "node-fetch";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DeviceType } from "@bitwarden/common/enums";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NodeApiService } from "./node-api.service";

// https-proxy-agent ships as ESM, which jest cannot load through the dynamic
// import in nativeFetch. The proxy-selection logic under test lives in
// proxy-from-env, so a constructor stub is sufficient here.
jest.mock("https-proxy-agent", () => ({
  HttpsProxyAgent: jest.fn().mockImplementation((proxy: string) => ({ proxy })),
}));

const PROXY_ENV_VARS = [
  "http_proxy",
  "HTTP_PROXY",
  "https_proxy",
  "HTTPS_PROXY",
  "all_proxy",
  "ALL_PROXY",
  "no_proxy",
  "NO_PROXY",
];

describe("NodeApiService", () => {
  let service: NodeApiService;
  let fetchMock: jest.Mock;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const envVar of PROXY_ENV_VARS) {
      delete process.env[envVar];
    }

    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getDevice.mockReturnValue(DeviceType.LinuxCLI);

    service = new NodeApiService(
      mock<TokenService>(),
      platformUtilsService,
      mock<EnvironmentService>(),
      mock<AppIdService>(),
      jest.fn(),
      mock<LogService>(),
      jest.fn(),
      mock<VaultTimeoutSettingsService>(),
      mock<AccountService>(),
    );

    fetchMock = jest.fn().mockResolvedValue({} as Response);
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as any).fetch = originalFetch;
  });

  async function fetchAgentFor(url: string): Promise<unknown> {
    const request = new fe.Request(url) as unknown as Request;
    await service.nativeFetch(request);
    return (request as any).agent;
  }

  describe("nativeFetch", () => {
    it("passes the request through to fetch", async () => {
      const request = new fe.Request("https://api.bitwarden.com/sync") as unknown as Request;

      await service.nativeFetch(request);

      expect(fetchMock).toHaveBeenCalledWith(request);
    });

    it("does not use a proxy when no proxy environment variables are set", async () => {
      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("uses the proxy from https_proxy for https requests", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toEqual({ proxy: "http://proxy.example.com:8080" });
    });

    it("uses the proxy from HTTPS_PROXY (uppercase) for https requests", async () => {
      process.env.HTTPS_PROXY = "http://proxy.example.com:8080";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeDefined();
    });

    it("uses the proxy from http_proxy for http requests", async () => {
      process.env.http_proxy = "http://proxy.example.com:8080";

      const agent = await fetchAgentFor("http://selfhosted.example.com/api/sync");

      expect(agent).toBeDefined();
    });

    it("uses the proxy from all_proxy when no protocol-specific proxy is set", async () => {
      process.env.all_proxy = "http://proxy.example.com:8080";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeDefined();
    });

    it("bypasses the proxy when no_proxy contains the exact hostname", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.no_proxy = "api.bitwarden.com";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("bypasses the proxy when NO_PROXY (uppercase) contains the exact hostname", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.NO_PROXY = "api.bitwarden.com";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("bypasses the proxy when no_proxy is a wildcard", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.no_proxy = "*";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("bypasses the proxy when no_proxy contains a matching domain suffix", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.no_proxy = ".bitwarden.com";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("bypasses the proxy when no_proxy contains the hostname in a comma-separated list", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.no_proxy = "localhost,127.0.0.1,api.bitwarden.com";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeUndefined();
    });

    it("still uses the proxy when no_proxy does not match the hostname", async () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      process.env.no_proxy = "other.example.com";

      const agent = await fetchAgentFor("https://api.bitwarden.com/sync");

      expect(agent).toBeDefined();
    });
  });
});
