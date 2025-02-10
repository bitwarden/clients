import { mock } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BrowserApi } from "../../platform/browser/browser-api";

import { ForegroundBrowserBiometricsService } from "./foreground-browser-biometrics";

jest.mock("../../platform/browser/browser-api", () => ({
  BrowserApi: {
    sendMessageWithResponse: jest.fn(),
    permissionsGranted: jest.fn(),
  },
}));

describe("foreground browser biometrics service tests", function () {
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [boolean, boolean, boolean, boolean][] = [
      // canEnableBiometricUnlock from background, native permission granted, isSafari, expected

      // needs permission prompt; always allowed
      [true, false, false, true],
      [false, false, false, true],

      // is safari; depends on the status that the background service reports
      [false, false, true, false],
      [true, false, true, true],

      // native permissions granted; depends on the status that the background service reports
      [false, true, false, false],
      [true, true, false, true],

      // should never happen since safari does not use the permissions
      [false, true, true, false],
      [true, true, true, true],
    ];
    test.each(table)(
      "canEnableBiometric: %s, native permission granted: %s, isSafari: %s, expected: %s",
      async (canEnableBiometricUnlockBackground, granted, isSafari, expected) => {
        const service = new ForegroundBrowserBiometricsService(platformUtilsService);

        (BrowserApi.permissionsGranted as jest.Mock).mockResolvedValue(granted);
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
