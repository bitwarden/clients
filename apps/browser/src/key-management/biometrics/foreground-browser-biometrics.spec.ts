import { BrowserApi } from "../../platform/browser/browser-api";

import { ForegroundBrowserBiometricsService } from "./foreground-browser-biometrics";

jest.mock("../../platform/browser/browser-api", () => ({
  BrowserApi: {
    sendMessageWithResponse: jest.fn(),
  },
}));

describe("foreground browser biometrics service tests", function () {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [boolean, boolean][] = [
      [false, false],
      [true, true],
    ];
    test.each(table)(
      "canEnableBiometric: %s, expected: %s",
      async (canEnableBiometricUnlockBackground, expected) => {
        const service = new ForegroundBrowserBiometricsService();

        (BrowserApi.sendMessageWithResponse as jest.Mock).mockResolvedValue({
          result: canEnableBiometricUnlockBackground,
        });

        const result = await service.canEnableBiometricUnlock();

        expect(result).toBe(expected);
      },
    );
  });
});
