import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { BiometricAction } from "../../types/biometric-message";

import { DesktopBiometricsService } from "./desktop.biometrics.service";
import { MainBiometricsIPCListener } from "./main-biometrics-ipc.listener";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

type BiometricHandler = (event: unknown, message: unknown) => Promise<unknown>;

const TEST_USER_ID = "user-id";
const TEST_KEY_B64 = new SymmetricCryptoKey(new Uint8Array(64)).toBase64();

function captureBiometricHandler(biometricsService: DesktopBiometricsService): BiometricHandler {
  const listener = new MainBiometricsIPCListener(biometricsService, mock<ConsoleLogService>());
  listener.init();
  return (ipcMain.handle as jest.Mock).mock.calls[0][1] as BiometricHandler;
}

describe("MainBiometricsIPCListener", () => {
  let biometricsService: jest.Mocked<DesktopBiometricsService>;

  beforeEach(() => {
    biometricsService = mock<DesktopBiometricsService>();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("enrollPersistent", () => {
    // The renderer records the enrolled key id once the IPC call resolves. A swallowed failure
    // would record the new key id without a matching enrollment, and the biometric re-enrollment
    // migration would then never retry.
    it("rejects when enrollment fails", async () => {
      const enrollmentError = new Error("Failed to parse user key");
      biometricsService.enrollPersistent.mockRejectedValue(enrollmentError);
      const handler = captureBiometricHandler(biometricsService);

      await expect(
        handler(null, {
          action: BiometricAction.EnrollPersistent,
          userId: TEST_USER_ID,
          key: TEST_KEY_B64,
        }),
      ).rejects.toThrow(enrollmentError);
    });

    it("resolves when enrollment succeeds", async () => {
      biometricsService.enrollPersistent.mockResolvedValue();
      const handler = captureBiometricHandler(biometricsService);

      await expect(
        handler(null, {
          action: BiometricAction.EnrollPersistent,
          userId: TEST_USER_ID,
          key: TEST_KEY_B64,
        }),
      ).resolves.toBeUndefined();
      expect(biometricsService.enrollPersistent).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.any(SymmetricCryptoKey),
      );
    });
  });

  it("swallows failures of other actions", async () => {
    biometricsService.hasPersistentKey.mockRejectedValue(new Error("Keychain unavailable"));
    const handler = captureBiometricHandler(biometricsService);

    await expect(
      handler(null, { action: BiometricAction.HasPersistentKey, userId: TEST_USER_ID }),
    ).resolves.toBeUndefined();
  });
});
