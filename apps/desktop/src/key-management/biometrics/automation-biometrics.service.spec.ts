import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

import { AutomationBiometricsService } from "./automation-biometrics.service";

describe("AutomationBiometricsService", () => {
  const userId = "user-id" as UserId;
  const key = new SymmetricCryptoKey(new Uint8Array(64)) as SymmetricCryptoKey;

  let sut: AutomationBiometricsService;

  beforeEach(() => {
    sut = new AutomationBiometricsService(mock<LogService>());
  });

  describe("mock status", () => {
    it("defaults to Available at the platform level", async () => {
      await expect(sut.supportsBiometrics()).resolves.toBe(true);
    });

    it("reports the configured status", async () => {
      sut.setMockStatus(BiometricsStatus.HardwareUnavailable);

      await expect(sut.supportsBiometrics()).resolves.toBe(false);
      await expect(sut.getBiometricsFirstUnlockStatusForUser(userId)).resolves.toBe(
        BiometricsStatus.HardwareUnavailable,
      );
    });
  });

  describe("getBiometricsFirstUnlockStatusForUser", () => {
    it("returns the platform status when biometrics are not available", async () => {
      sut.setMockStatus(BiometricsStatus.HardwareUnavailable);

      await expect(sut.getBiometricsFirstUnlockStatusForUser(userId)).resolves.toBe(
        BiometricsStatus.HardwareUnavailable,
      );
    });

    it("returns UnlockNeeded when available but no key is held for the user", async () => {
      await expect(sut.getBiometricsFirstUnlockStatusForUser(userId)).resolves.toBe(
        BiometricsStatus.UnlockNeeded,
      );
    });

    it("returns Available when available and a key is held for the user", async () => {
      await sut.setBiometricKey(userId, key);

      await expect(sut.getBiometricsFirstUnlockStatusForUser(userId)).resolves.toBe(
        BiometricsStatus.Available,
      );
    });
  });

  describe("pending authentication requests", () => {
    it("lists a pending request and resolves true on approval", async () => {
      const result = sut.authenticateBiometric();

      const pending = sut.listPendingRequests();
      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe("authenticate");

      sut.approveRequest();

      await expect(result).resolves.toBe(true);
      expect(sut.listPendingRequests()).toHaveLength(0);
    });

    it("resolves false on denial", async () => {
      const result = sut.authenticateBiometric();

      sut.denyRequest();

      await expect(result).resolves.toBe(false);
    });

    it("resolves a specific request by id", async () => {
      const first = sut.authenticateBiometric();
      const second = sut.authenticateBiometric();

      const [, secondPending] = sut.listPendingRequests();
      sut.approveRequest(secondPending.id);

      await expect(second).resolves.toBe(true);
      expect(sut.listPendingRequests()).toHaveLength(1);

      sut.denyRequest();
      await expect(first).resolves.toBe(false);
    });
  });

  describe("biometric keys", () => {
    it("returns the stored key after unlock approval", async () => {
      await sut.setBiometricKey(userId, key);

      const result = sut.getBiometricKey(userId);
      sut.approveRequest();

      await expect(result).resolves.toBe(key);
    });

    it("returns null after unlock denial", async () => {
      await sut.setBiometricKey(userId, key);

      const result = sut.getBiometricKey(userId);
      sut.denyRequest();

      await expect(result).resolves.toBeNull();
    });

    it("tracks persistent keys", async () => {
      await expect(sut.hasPersistentKey(userId)).resolves.toBe(false);

      await sut.enrollPersistent(userId, key);

      await expect(sut.hasPersistentKey(userId)).resolves.toBe(true);
    });

    it("deletes keys", async () => {
      await sut.setBiometricKey(userId, key);

      await sut.deleteBiometricKey(userId);

      const result = sut.getBiometricKey(userId);
      sut.approveRequest();
      await expect(result).resolves.toBeNull();
    });
  });
});
