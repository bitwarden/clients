import { ExtensionTwoFactorAuthWebAuthnComponentService } from "./extension-two-factor-auth-webauthn-component.service";

describe("ExtensionTwoFactorAuthWebAuthnComponentService", () => {
  let extensionTwoFactorAuthWebAuthnComponentService: ExtensionTwoFactorAuthWebAuthnComponentService;

  beforeEach(() => {
    jest.clearAllMocks();

    extensionTwoFactorAuthWebAuthnComponentService =
      new ExtensionTwoFactorAuthWebAuthnComponentService();
  });

  describe("shouldOpenWebAuthnInNewTab", () => {
    it("should return true", () => {
      // Act
      const result = extensionTwoFactorAuthWebAuthnComponentService.shouldOpenWebAuthnInNewTab();

      // Assert
      expect(result).toBe(true);
    });
  });
});
