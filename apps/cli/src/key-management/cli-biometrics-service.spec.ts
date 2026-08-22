import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import {
  BiometricsStatus as SdkBiometricsStatus,
  IpcClient,
  SymmetricKey,
  ipcRequestAuthenticateBiometrics,
  ipcRequestGetBiometricsStatus,
  ipcRequestUnlockBiometrics,
} from "@bitwarden/sdk-internal";

import { CliIpcService } from "../platform/services/cli-ipc.service";

import { CliBiometricsService } from "./cli-biometrics-service";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  ipcRequestAuthenticateBiometrics: jest.fn(),
  ipcRequestGetBiometricsStatus: jest.fn(),
  ipcRequestUnlockBiometrics: jest.fn(),
}));

describe("CliBiometricsService", () => {
  const userId = "user-id" as UserId;
  const accountService = mock<AccountService>();
  const keyService = mock<KeyService>();
  const logService = mock<LogService>();
  const ipcService = mock<CliIpcService>();
  const ipcClient = mock<IpcClient>();

  let service: CliBiometricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    accountService.activeAccount$ = of({ id: userId } as never);
    ipcService.verifyDesktopConnection.mockResolvedValue("2026.7.0");
    Object.defineProperty(ipcService, "client", { configurable: true, value: ipcClient });
    service = new CliBiometricsService(accountService, keyService, logService, ipcService);
  });

  it("returns the desktop biometric status for the active account", async () => {
    jest.mocked(ipcRequestGetBiometricsStatus).mockResolvedValue(SdkBiometricsStatus.Available);

    await expect(service.getBiometricsStatus()).resolves.toBe(BiometricsStatus.Available);
    expect(ipcService.verifyDesktopConnection).toHaveBeenCalled();
  });

  it("maps desktop NotEnabled to NotEnabledInConnectedDesktopApp", async () => {
    jest.mocked(ipcRequestGetBiometricsStatus).mockResolvedValue(SdkBiometricsStatus.NotEnabled);

    await expect(service.getBiometricsStatusForUser(userId)).resolves.toBe(
      BiometricsStatus.NotEnabledInConnectedDesktopApp,
    );
  });

  it("reports DesktopDisconnected when the SDK IPC handshake fails", async () => {
    ipcService.verifyDesktopConnection.mockRejectedValue(new Error("Desktop is too old"));

    await expect(service.getBiometricsStatusForUser(userId)).resolves.toBe(
      BiometricsStatus.DesktopDisconnected,
    );
    expect(logService.info).toHaveBeenCalledWith(
      "Could not query Bitwarden Desktop biometric status",
      expect.any(Error),
    );
  });

  it("returns a validated user key from desktop biometric unlock", async () => {
    const sdkKey = mock<SymmetricKey>();
    const userKey = mock<UserKey>();
    jest.mocked(ipcRequestUnlockBiometrics).mockResolvedValue({ user_key: sdkKey });
    jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(userKey);
    keyService.validateUserKey.mockResolvedValue(true);

    await expect(service.unlockWithBiometricsForUser(userId)).resolves.toBe(userKey);
    expect(keyService.validateUserKey).toHaveBeenCalledWith(userKey, userId);
  });

  it("rejects an invalid user key returned by desktop", async () => {
    const sdkKey = mock<SymmetricKey>();
    const userKey = mock<UserKey>();
    jest.mocked(ipcRequestUnlockBiometrics).mockResolvedValue({ user_key: sdkKey });
    jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(userKey);
    keyService.validateUserKey.mockResolvedValue(false);

    await expect(service.unlockWithBiometricsForUser(userId)).resolves.toBeNull();
  });

  it("authenticates through desktop SDK IPC", async () => {
    jest.mocked(ipcRequestAuthenticateBiometrics).mockResolvedValue(true);

    await expect(service.authenticateWithBiometrics()).resolves.toBe(true);
    expect(ipcService.verifyDesktopConnection).toHaveBeenCalled();
  });

  it("disconnects the desktop transport", () => {
    service.disconnect();

    expect(ipcService.disconnect).toHaveBeenCalled();
  });
});
