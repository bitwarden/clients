import { MockProxy, mock } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ExtensionTwoFactorAuthWebAuthnComponentService } from "./extension-two-factor-auth-webauthn-component.service";

describe("ExtensionTwoFactorAuthWebAuthnComponentService", () => {
  let extensionTwoFactorAuthWebAuthnComponentService: ExtensionTwoFactorAuthWebAuthnComponentService;

  let platformUtilsService: MockProxy<PlatformUtilsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    platformUtilsService = mock<PlatformUtilsService>();

    extensionTwoFactorAuthWebAuthnComponentService =
      new ExtensionTwoFactorAuthWebAuthnComponentService(platformUtilsService);
  });

  describe("shouldOpenWebAuthnInNewTab", () => {
    it("should return false if the browser is Chrome", () => {
      // Arrange
      platformUtilsService.isChrome.mockReturnValue(true);

      // Act
      const result = extensionTwoFactorAuthWebAuthnComponentService.shouldOpenWebAuthnInNewTab();

      // Assert
      expect(result).toBe(false);
    });

    it("should return true if the browser is not Chrome", () => {
      // Arrange
      platformUtilsService.isChrome.mockReturnValue(false);

      // Act
      const result = extensionTwoFactorAuthWebAuthnComponentService.shouldOpenWebAuthnInNewTab();

      // Assert
      expect(result).toBe(true);
    });
  });
});
