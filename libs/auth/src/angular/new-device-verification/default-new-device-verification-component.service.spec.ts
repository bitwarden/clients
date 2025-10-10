import { DefaultNewDeviceVerificationComponentService } from "./default-new-device-verification-component.service";

describe("DefaultNewDeviceVerificationComponentService", () => {
  let sut: DefaultNewDeviceVerificationComponentService;

  beforeEach(() => {
    sut = new DefaultNewDeviceVerificationComponentService();
  });

  it("should instantiate the service", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("showBackButton()", () => {
    it("should return true", () => {
      const result = sut.showBackButton();

      expect(result).toBe(true);
    });
  });
});
