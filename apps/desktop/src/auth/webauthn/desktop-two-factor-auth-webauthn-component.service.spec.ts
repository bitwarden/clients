import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { DesktopTwoFactorAuthWebAuthnComponentService } from "./desktop-two-factor-auth-webauthn-component.service";

// jsdom does not implement WebAuthn.
class FakePublicKeyCredential {}
class FakeAuthenticatorAssertionResponse {}
(globalThis as any).PublicKeyCredential = FakePublicKeyCredential;
(globalThis as any).AuthenticatorAssertionResponse = FakeAuthenticatorAssertionResponse;

describe("DesktopTwoFactorAuthWebAuthnComponentService", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let configService: MockProxy<ConfigService>;
  let get: jest.Mock;
  let win: Window;
  let service: DesktopTwoFactorAuthWebAuthnComponentService;

  function credential(): PublicKeyCredential {
    const response = Object.assign(new FakeAuthenticatorAssertionResponse(), {
      authenticatorData: new Uint8Array([1]).buffer,
      clientDataJSON: new Uint8Array([2]).buffer,
      signature: new Uint8Array([3]).buffer,
    });
    return Object.assign(new FakePublicKeyCredential(), {
      id: "BAUG",
      rawId: new Uint8Array([4, 5, 6]).buffer,
      type: "public-key",
      response,
      getClientExtensionResults: () => ({ appid: true }),
    }) as unknown as PublicKeyCredential;
  }

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    configService = mock<ConfigService>();
    get = jest.fn().mockResolvedValue(credential());
    win = { navigator: { credentials: { get } } } as unknown as Window;
    service = new DesktopTwoFactorAuthWebAuthnComponentService(platformUtilsService, configService);
  });

  describe("shouldAuthenticateInWindow", () => {
    beforeEach(() => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
    });

    it.each([true, false])("follows the platform's feature flag when it is %s", async (flag) => {
      configService.getFeatureFlag$.mockReturnValue(of(flag));

      await expect(service.shouldAuthenticateInWindow()).resolves.toBe(flag);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM46060_DesktopWebAuthnClientWindows,
      );
    });
  });

  describe("authenticateInWindow", () => {
    const options: PublicKeyCredentialRequestOptions = {
      challenge: new Uint8Array([1, 2, 3]),
      rpId: "vault.example.com",
      allowCredentials: [{ type: "public-key", id: new Uint8Array([4, 5, 6]) }],
      extensions: { appid: "https://vault.example.com/app-id.json" },
    };

    it("requests an assertion with the options", async () => {
      await service.authenticateInWindow(options, win);

      expect(get).toHaveBeenCalledWith({ publicKey: options });
    });

    it("returns the token in the format of the web vault's WebAuthn connector", async () => {
      const token = await service.authenticateInWindow(options, win);

      expect(JSON.parse(token)).toEqual({
        id: "BAUG",
        rawId: "BAUG",
        type: "public-key",
        extensions: { appid: true },
        response: { authenticatorData: "AQ", clientDataJson: "Ag", signature: "Aw" },
      });
    });

    it("throws if no public key credential is returned", async () => {
      get.mockResolvedValue(null);

      await expect(service.authenticateInWindow(options, win)).rejects.toThrow();
    });
  });
});
