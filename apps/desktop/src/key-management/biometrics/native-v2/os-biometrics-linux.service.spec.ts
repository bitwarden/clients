import { UserId } from "@bitwarden/common/types/guid";
import { biometrics, passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import OsBiometricsServiceLinux from "./os-biometrics-linux.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  biometrics: {
    initBiometricSystem: jest.fn(() => "mockSystem"),
    provideKey: jest.fn(),
    unenroll: jest.fn(),
    unlock: jest.fn(),
    authenticate: jest.fn(),
    authenticateAvailable: jest.fn(),
    unlockAvailable: jest.fn(),
    enrollPersistent: jest.fn(),
    hasPersistent: jest.fn(),
  },
  passwords: {
    isAvailable: jest.fn(),
  },
}));

const mockKey = new Uint8Array(64);

jest.mock("../../../main/platform-utils.main", () => ({
  isFlatpak: jest.fn(() => false),
  isLinux: jest.fn(() => true),
  isSnapStore: jest.fn(() => false),
}));

describe("OsBiometricsServiceLinux", () => {
  const userId = "user-id" as UserId;
  const key = { toEncoded: () => ({ buffer: Buffer.from(mockKey) }) } as SymmetricCryptoKey;
  let service: OsBiometricsServiceLinux;

  beforeEach(() => {
    service = new OsBiometricsServiceLinux();
    jest.clearAllMocks();
  });

  it("should set biometric key", async () => {
    await service.setBiometricKey(userId, key);
    expect(biometrics.provideKey).toHaveBeenCalled();
  });

  it("should delete biometric key", async () => {
    await service.deleteBiometricKey(userId);
    expect(biometrics.unenroll).toHaveBeenCalled();
  });

  it("should get biometric key", async () => {
    (biometrics.unlock as jest.Mock).mockResolvedValue(mockKey);
    const result = await service.getBiometricKey(userId);
    expect(result).toBeInstanceOf(SymmetricCryptoKey);
  });

  it("should return null if no biometric key", async () => {
    (biometrics.unlock as jest.Mock).mockResolvedValue(null);
    const result = await service.getBiometricKey(userId);
    expect(result).toBeNull();
  });

  it("should authenticate biometric", async () => {
    (biometrics.authenticate as jest.Mock).mockResolvedValue(true);
    const result = await service.authenticateBiometric();
    expect(result).toBe(true);
  });

  it("should check if biometrics is supported", async () => {
    (passwords.isAvailable as jest.Mock).mockResolvedValue(true);
    const result = await service.supportsBiometrics();
    expect(result).toBe(true);
  });

  it("should check if setup is needed", async () => {
    (biometrics.authenticateAvailable as jest.Mock).mockResolvedValue(false);
    const result = await service.needsSetup();
    expect(result).toBe(true);
  });

  it("should check if can auto setup", async () => {
    const result = await service.canAutoSetup();
    expect(result).toBe(true);
  });

  it("should get biometrics first unlock status for user", async () => {
    (biometrics.unlockAvailable as jest.Mock).mockResolvedValue(true);
    const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
    expect(result).toBe(BiometricsStatus.Available);
  });

  it("should return unlock needed if no key is available for first unlock", async () => {
    (biometrics.unlockAvailable as jest.Mock).mockResolvedValue(false);
    const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
    expect(result).toBe(BiometricsStatus.UnlockNeeded);
  });

  it("should enroll a persistent key", async () => {
    await service.enrollPersistent(userId, key);
    expect(biometrics.enrollPersistent).toHaveBeenCalledWith(
      "mockSystem",
      userId,
      Buffer.from(mockKey),
    );
  });

  it("should return whether a persistent key is enrolled", async () => {
    (biometrics.hasPersistent as jest.Mock).mockResolvedValue(true);
    expect(await service.hasPersistentKey(userId)).toBe(true);

    (biometrics.hasPersistent as jest.Mock).mockResolvedValue(false);
    expect(await service.hasPersistentKey(userId)).toBe(false);
  });
});
