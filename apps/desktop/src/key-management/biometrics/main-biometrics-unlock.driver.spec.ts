import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus } from "@bitwarden/key-management";
import { BiometricsStatus as SdkBiometricsStatus } from "@bitwarden/sdk-internal";

import { DesktopBiometricsService } from "./desktop.biometrics.service";
import { MainBiometricsUnlockDriver } from "./main-biometrics-unlock.driver";

// The SDK enum is the only runtime value the driver (via the status mapper) depends on.
jest.mock("@bitwarden/sdk-internal", () => ({
  BiometricsStatus: {
    Available: "available",
    HardwareUnavailable: "hardwareUnavailable",
    NotEnabled: "notEnabled",
    UnlockNeeded: "unlockNeeded",
  },
  LogLevel: { Debug: 0, Info: 1, Warn: 2, Error: 3 },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("MainBiometricsUnlockDriver", () => {
  const connectedUserId = "connected-user" as UserId;
  const unknownUserId = "unknown-user" as UserId;

  let biometricsService: jest.Mocked<DesktopBiometricsService>;
  let accountService: jest.Mocked<AccountService>;
  let driver: MainBiometricsUnlockDriver;

  beforeEach(() => {
    biometricsService = mock<DesktopBiometricsService>();
    accountService = mock<AccountService>();
    accountService.accounts$ = of({
      [connectedUserId]: { name: "Connected", email: "connected@example.com", emailVerified: true },
    });
    driver = new MainBiometricsUnlockDriver(biometricsService, accountService);
  });

  describe("get_biometrics_status", () => {
    it("returns NotEnabled without querying biometrics for a user not connected to the desktop app", async () => {
      const status = await driver.get_biometrics_status(unknownUserId);

      expect(status).toBe(SdkBiometricsStatus.NotEnabled);
      expect(biometricsService.getBiometricsStatusForUser).not.toHaveBeenCalled();
    });

    it("delegates to the biometrics service and maps the status for a connected user", async () => {
      biometricsService.getBiometricsStatusForUser.mockResolvedValue(BiometricsStatus.Available);

      const status = await driver.get_biometrics_status(connectedUserId);

      expect(biometricsService.getBiometricsStatusForUser).toHaveBeenCalledWith(connectedUserId);
      expect(status).toBe(SdkBiometricsStatus.Available);
    });
  });

  describe("unlock_biometrics", () => {
    it("returns undefined when no user key is produced", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(null);

      const result = await driver.unlock_biometrics(connectedUserId);

      expect(result).toBeUndefined();
    });

    it("returns the SDK-encoded user key when unlock succeeds", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(userKey);

      const result = await driver.unlock_biometrics(connectedUserId);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(connectedUserId);
      expect(result).toBe(userKey.toSdk());
    });
  });

  describe("authenticate_biometrics", () => {
    it("delegates to the biometrics service", async () => {
      biometricsService.authenticateWithBiometrics.mockResolvedValue(true);

      const result = await driver.authenticate_biometrics();

      expect(result).toBe(true);
    });
  });
});
