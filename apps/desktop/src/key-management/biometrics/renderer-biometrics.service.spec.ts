import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
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

  describe("unlockWithBiometricsForUser", () => {
    const testUserId = "userId1" as UserId;
    const service = new RendererBiometricsService();

    it("should return null if no user key is returned", async () => {
      (global as any).ipc.keyManagement.biometric.unlockWithBiometricsForUser.mockResolvedValue(
        null,
      );

      const result = await service.unlockWithBiometricsForUser(testUserId);

      expect(result).toBeNull();
    });

    it("should return a UserKey object when a user key is returned", async () => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      (global as any).ipc.keyManagement.biometric.unlockWithBiometricsForUser.mockResolvedValue(
        mockUserKey.toJSON(),
      );

      const result = await service.unlockWithBiometricsForUser(testUserId);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(SymmetricCryptoKey);
      expect(result!.keyB64).toEqual(mockUserKey.keyB64);
      expect(result!.inner()).toEqual(mockUserKey.inner());
    });
  });
});
