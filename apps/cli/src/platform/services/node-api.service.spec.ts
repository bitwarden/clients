import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DeviceType } from "@bitwarden/common/enums";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NodeApiService } from "./node-api.service";

describe("NodeApiService", () => {
  let service: NodeApiService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

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
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("shouldBypassProxy", () => {
    it("should return false when no_proxy is not set", () => {
      delete process.env.no_proxy;
      delete process.env.NO_PROXY;

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com")).toBe(false);
    });

    it("should return true when no_proxy contains exact hostname", () => {
      process.env.no_proxy = "api.bitwarden.com";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
    });

    it("should return true when NO_PROXY (uppercase) contains exact hostname", () => {
      process.env.NO_PROXY = "api.bitwarden.com";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
    });

    it("should return true when no_proxy contains domain with leading dot", () => {
      process.env.no_proxy = ".bitwarden.com";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://vault.bitwarden.com/test")).toBe(true);
    });

    it("should return true when no_proxy contains domain without leading dot (suffix match)", () => {
      process.env.no_proxy = "bitwarden.com";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://bitwarden.com/test")).toBe(true);
    });

    it("should return false when hostname does not match no_proxy", () => {
      process.env.no_proxy = "other.com";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(false);
    });

    it("should handle comma-separated list in no_proxy", () => {
      process.env.no_proxy = "localhost,127.0.0.1,bitwarden.com";

      expect((service as any).shouldBypassProxy("https://localhost/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://127.0.0.1/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://external.com/test")).toBe(false);
    });

    it("should return true when no_proxy is *", () => {
      process.env.no_proxy = "*";

      expect((service as any).shouldBypassProxy("https://any.domain.com/test")).toBe(true);
    });

    it("should handle case insensitivity", () => {
      process.env.no_proxy = "BITWARDEN.COM";

      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
    });

    it("should handle whitespace in no_proxy entries", () => {
      process.env.no_proxy = " localhost , bitwarden.com ";

      expect((service as any).shouldBypassProxy("https://localhost/test")).toBe(true);
      expect((service as any).shouldBypassProxy("https://api.bitwarden.com/test")).toBe(true);
    });

    it("should return false for invalid URL", () => {
      process.env.no_proxy = "bitwarden.com";

      expect((service as any).shouldBypassProxy("not-a-valid-url")).toBe(false);
    });
  });
});
