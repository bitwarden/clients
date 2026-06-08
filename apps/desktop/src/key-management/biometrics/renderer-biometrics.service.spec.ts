import { mock } from "jest-mock-extended";

import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { RendererBiometricsService } from "./renderer-biometrics.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  CryptoClient: {
    get_key_id_for_symmetric_key: jest.fn(),
  },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("renderer biometrics service tests", function () {
  let tokenService: TokenService;
  let biometricStateService: BiometricStateService;

  beforeEach(() => {
    tokenService = mock<TokenService>();
    biometricStateService = mock<BiometricStateService>();
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
          enrollPersistent: jest.fn(),
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
    const service = new RendererBiometricsService(tokenService, biometricStateService);

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

  describe("enrollPersistent", () => {
    const testUserId = "userId1" as UserId;
    const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const mockKeyId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    const getKeyIdMock = () => (CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock;

    it("stores the derived key id when the SDK returns a key id", async () => {
      const service = new RendererBiometricsService(tokenService, biometricStateService);
      getKeyIdMock().mockReturnValue(mockKeyId);

      await service.enrollPersistent(testUserId, mockUserKey);

      expect((global as any).ipc.keyManagement.biometric.enrollPersistent).toHaveBeenCalledWith(
        testUserId,
        mockUserKey.toBase64(),
      );
      expect(biometricStateService.setBiometricEnrolledKeyId).toHaveBeenCalledWith(
        testUserId,
        Utils.fromBufferToB64(mockKeyId),
      );
    });

    it("clears the enrolled key id when the SDK returns no key id", async () => {
      const service = new RendererBiometricsService(tokenService, biometricStateService);
      getKeyIdMock().mockReturnValue(null);

      await service.enrollPersistent(testUserId, mockUserKey);

      expect(biometricStateService.setBiometricEnrolledKeyId).toHaveBeenCalledWith(
        testUserId,
        null,
      );
    });
  });
});
