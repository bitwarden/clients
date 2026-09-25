import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { passwords } from "@bitwarden/desktop-napi";

import { DesktopCredentialStorageListener } from "./desktop-credential-storage-listener";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  passwords: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found",
  },
}));

type KeytarHandler = (event: unknown, message: unknown) => Promise<unknown>;

function captureKeytarHandler(baseServiceName: string): KeytarHandler {
  const listener = new DesktopCredentialStorageListener(baseServiceName, mock<ConsoleLogService>());
  listener.init();
  return (ipcMain.handle as jest.Mock).mock.calls[0][1] as KeytarHandler;
}

describe("DesktopCredentialStorageListener", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("biometric IPC gate", () => {
    // The renderer must not be able to reach the biometric slot through the
    // keytar IPC channel. The gate compares the resolved service name against
    // `${baseServiceName}_biometric` and short-circuits when they match.

    it("blocks renderer access to the biometric slot on the stable channel", async () => {
      const handler = captureKeytarHandler("Bitwarden");

      const result = await handler(null, {
        action: "getPassword",
        key: "user-id_user_biometric",
        keySuffix: "biometric",
      });

      expect(result).toBeUndefined();
      expect(passwords.getPassword).not.toHaveBeenCalled();
    });

    it("blocks renderer access to the biometric slot on the Beta channel", async () => {
      const handler = captureKeytarHandler("Bitwarden Beta");

      const result = await handler(null, {
        action: "getPassword",
        key: "user-id_user_biometric",
        keySuffix: "biometric",
      });

      expect(result).toBeUndefined();
      expect(passwords.getPassword).not.toHaveBeenCalled();
    });

    it("does not block non-biometric renderer calls", async () => {
      (passwords.getPassword as jest.Mock).mockResolvedValueOnce("secret");
      const handler = captureKeytarHandler("Bitwarden");

      const result = await handler(null, {
        action: "getPassword",
        key: "user-id",
        keySuffix: "",
      });

      expect(result).toBe("secret");
      expect(passwords.getPassword).toHaveBeenCalledWith("Bitwarden", "user-id");
    });

    it("does not block a non-biometric renderer call on the Beta channel", async () => {
      (passwords.getPassword as jest.Mock).mockResolvedValueOnce("secret");
      const handler = captureKeytarHandler("Bitwarden Beta");

      const result = await handler(null, {
        action: "getPassword",
        key: "user-id",
        keySuffix: "",
      });

      expect(result).toBe("secret");
      expect(passwords.getPassword).toHaveBeenCalledWith("Bitwarden Beta", "user-id");
    });
  });
});
