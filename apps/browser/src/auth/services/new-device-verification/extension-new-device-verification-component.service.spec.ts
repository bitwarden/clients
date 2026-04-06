import { ExtensionNewDeviceVerificationComponentService } from "./extension-new-device-verification-component.service";

describe("ExtensionNewDeviceVerificationComponentService", () => {
  let sut: ExtensionNewDeviceVerificationComponentService;

  beforeEach(() => {
    sut = new ExtensionNewDeviceVerificationComponentService();
  });

  it("should instantiate the service", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("showBackButton()", () => {
    it("should return false", () => {
      const result = sut.showBackButton();

      expect(result).toBe(false);
    });
  });
});
