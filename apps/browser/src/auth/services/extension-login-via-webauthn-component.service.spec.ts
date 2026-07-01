import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ExtensionLoginViaWebAuthnComponentService } from "./extension-login-via-webauthn-component.service";

describe("ExtensionLoginViaWebAuthnComponentService", () => {
  let service: ExtensionLoginViaWebAuthnComponentService;
  let platformUtilsService: PlatformUtilsService;
  let environmentService: EnvironmentService;

  const webVaultUrl = "https://vault.bitwarden.com";
  const extensionPublicKey = "extension-public-key";

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    environmentService = mock<EnvironmentService>();
    (environmentService.environment$ as any) = of({
      getWebVaultUrl: () => webVaultUrl,
    } as Environment);

    service = new ExtensionLoginViaWebAuthnComponentService(
      platformUtilsService,
      environmentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("shouldUseWebVaultRelay", () => {
    it("returns true for Firefox", () => {
      platformUtilsService.isFirefox = jest.fn().mockReturnValue(true);

      expect(service.shouldUseWebVaultRelay()).toBe(true);
    });

    it("returns false for non-Firefox browsers", () => {
      platformUtilsService.isFirefox = jest.fn().mockReturnValue(false);

      expect(service.shouldUseWebVaultRelay()).toBe(false);
    });
  });

  describe("openWebVaultRelayTab", () => {
    beforeEach(() => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({ result: extensionPublicKey });
    });

    it("requests an ephemeral ECDH public key and opens the connector tab in the URL fragment", async () => {
      platformUtilsService.isFirefox = jest.fn().mockReturnValue(true);

      await service.openWebVaultRelayTab();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ command: "initiatePasskeyRelay" });
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(`${webVaultUrl}/passkey-connector.html#`),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(`extensionPublicKey=${encodeURIComponent(extensionPublicKey)}`),
      );
    });

    it("throws when the background does not return a public key", async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({});

      await expect(service.openWebVaultRelayTab()).rejects.toThrow(
        "Failed to initiate passkey login relay",
      );
    });

    it("exposes layout flags used by the login via WebAuthn component", () => {
      expect(service.showTroubleLoggingInText).toBe(false);
      expect(service.leftAlignDescription).toBe(true);
    });
  });
});
