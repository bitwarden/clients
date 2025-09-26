import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics_v2 } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";

import OsBiometricsServiceWindows from "./os-biometrics-windows.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  biometrics_v2: {
    initBiometricSystem: jest.fn(() => "mockSystem"),
    provideKey: jest.fn(),
    enrollPersistent: jest.fn(),
    unenroll: jest.fn(),
    unlock: jest.fn(),
    authenticate: jest.fn(),
    authenticateAvailable: jest.fn(),
    unlockAvailable: jest.fn(),
    hasPersistent: jest.fn(),
  },
  passwords: {
    isAvailable: jest.fn(),
  },
}));

const mockKey = new Uint8Array(64);

jest.mock("../../../utils", () => ({
  isFlatpak: jest.fn(() => false),
  isLinux: jest.fn(() => true),
  isSnapStore: jest.fn(() => false),
}));

describe("OsBiometricsServiceWindows", () => {
  const userId = "user-id" as UserId;

  let service: OsBiometricsServiceWindows;
  let i18nService: I18nService;
  let windowMain: WindowMain;
  let logService: LogService;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    windowMain = mock<WindowMain>();
    logService = mock<LogService>();

    windowMain.win.getNativeWindowHandle = jest.fn().mockReturnValue(Buffer.from([1, 2, 3, 4]));
    service = new OsBiometricsServiceWindows(i18nService, windowMain, logService);
  });

  it("should enroll persistent biometric key", async () => {
    await service.enrollPersistent("user-id" as UserId, new SymmetricCryptoKey(mockKey));
    expect(biometrics_v2.enrollPersistent).toHaveBeenCalled();
  });

  it("should set biometric key", async () => {
    await service.setBiometricKey(userId, new SymmetricCryptoKey(mockKey));
    expect(biometrics_v2.provideKey).toHaveBeenCalled();
  });

  it("should delete biometric key", async () => {
    await service.deleteBiometricKey(userId);
    expect(biometrics_v2.unenroll).toHaveBeenCalled();
  });

  it("should get biometric key", async () => {
    (biometrics_v2.unlock as jest.Mock).mockResolvedValue(mockKey);
    const result = await service.getBiometricKey(userId);
    expect(result).toBeInstanceOf(SymmetricCryptoKey);
  });

  it("should return null if no biometric key", async () => {
    const error = new Error("No key found");
    (biometrics_v2.unlock as jest.Mock).mockRejectedValue(error);
    const result = await service.getBiometricKey(userId);
    expect(result).toBeNull();
    expect(logService.warning).toHaveBeenCalledWith(
      `[OsBiometricsServiceWindows] Fetching the biometric key failed: ${error} returning null`,
    );
  });

  it("should authenticate biometric", async () => {
    (biometrics_v2.authenticate as jest.Mock).mockResolvedValue(true);
    const result = await service.authenticateBiometric();
    expect(result).toBe(true);
  });

  it("should check if biometrics is supported", async () => {
    (biometrics_v2.authenticateAvailable as jest.Mock).mockResolvedValue(true);
    const result = await service.supportsBiometrics();
    expect(result).toBe(true);
  });

  it("should return needs setup false", async () => {
    const result = await service.needsSetup();
    expect(result).toBe(false);
  });

  it("should return auto setup false", async () => {
    const result = await service.canAutoSetup();
    expect(result).toBe(false);
  });

  it("should get biometrics first unlock status for user", async () => {
    (biometrics_v2.unlockAvailable as jest.Mock).mockResolvedValue(true);
    const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
    expect(result).toBe(BiometricsStatus.Available);
  });

  it("should return false for hasPersistentKey false", async () => {
    (biometrics_v2.hasPersistent as jest.Mock).mockResolvedValue(false);
    const result = await service.hasPersistentKey(userId);
    expect(result).toBe(false);
  });

  it("should return false for hasPersistentKey true", async () => {
    (biometrics_v2.hasPersistent as jest.Mock).mockResolvedValue(true);
    const result = await service.hasPersistentKey(userId);
    expect(result).toBe(true);
  });
});
