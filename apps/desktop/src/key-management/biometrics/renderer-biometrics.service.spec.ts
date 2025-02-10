import { BiometricsStatus } from "@bitwarden/key-management";

import { RendererBiometricsService } from "./renderer-biometrics.service";

describe("renderer biometrics service tests", function () {
  beforeEach(() => {
    (global as any).ipc = {
      keyManagement: {
        biometric: {
          authenticateWithBiometrics: jest.fn(),
          getBiometricsStatus: jest.fn(),
          unlockWithBiometricsForUser: jest.fn(),
          getBiometricsStatusForUser: jest.fn(),
          deleteBiometricUnlockKeyForUser: jest.fn(),
          setupBiometrics: jest.fn(),
          setClientKeyHalfForUser: jest.fn(),
          getShouldAutoprompt: jest.fn(),
          setShouldAutoprompt: jest.fn(),
        },
      },
    };
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [BiometricsStatus, boolean][] = [
      [BiometricsStatus.Available, true],
      [BiometricsStatus.AutoSetupNeeded, true],
      [BiometricsStatus.ManualSetupNeeded, true],

      [BiometricsStatus.UnlockNeeded, false],
      [BiometricsStatus.HardwareUnavailable, false],
      [BiometricsStatus.PlatformUnsupported, false],
      [BiometricsStatus.NotEnabledLocally, false],
    ];
    test.each(table)("canEnableBiometricUnlock(%s) === %s", async (status, expected) => {
      const service = new RendererBiometricsService();
      (global as any).ipc.keyManagement.biometric.getBiometricsStatus.mockResolvedValue(status);

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(expected);
    });
  });
});
