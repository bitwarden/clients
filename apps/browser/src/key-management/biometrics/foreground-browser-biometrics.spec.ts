import { mock } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BrowserApi } from "../../platform/browser/browser-api";

import { ForegroundBrowserBiometricsService } from "./foreground-browser-biometrics";

jest.mock("../../platform/browser/browser-api", () => ({
  BrowserApi: {
    sendMessageWithResponse: jest.fn(),
  },
}));

describe("foreground browser biometrics service tests", function () {
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [boolean, boolean, boolean][] = [
      [false, true, false],
      [true, true, true],
      [false, false, false],
      [true, false, true],
    ];
    test.each(table)(
      "canEnableBiometric: %s, isSafari: %s, expected: %s",
      async (canEnableBiometricUnlockBackground, isSafari, expected) => {
        const service = new ForegroundBrowserBiometricsService(platformUtilsService);

        (BrowserApi.sendMessageWithResponse as jest.Mock).mockResolvedValue({
          result: canEnableBiometricUnlockBackground,
        });
        platformUtilsService.isSafari.mockReturnValue(isSafari);

        const result = await service.canEnableBiometricUnlock();

        expect(result).toBe(expected);
      },
    );
  });
});
