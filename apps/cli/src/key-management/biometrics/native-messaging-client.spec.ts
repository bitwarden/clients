import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";

import { IpcSocketService } from "./ipc-socket.service";
import { NativeMessagingClient } from "./native-messaging-client";

// Mock the IpcSocketService module
jest.mock("./ipc-socket.service");

describe("NativeMessagingClient", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let appIdService: MockProxy<AppIdService>;
  let logService: MockProxy<LogService>;
  let accountService: MockProxy<AccountService>;
  let mockIpcSocketService: jest.Mocked<IpcSocketService>;

  let client: NativeMessagingClient;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    appIdService = mock<AppIdService>();
    logService = mock<LogService>();
    accountService = mock<AccountService>();

    // Set up the mock IpcSocketService
    mockIpcSocketService = {
      isSocketAvailable: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(),
      onMessage: jest.fn(),
      onDisconnect: jest.fn(),
      sendMessage: jest.fn(),
      getSocketPath: jest.fn(),
    } as unknown as jest.Mocked<IpcSocketService>;

    (IpcSocketService as jest.Mock).mockImplementation(() => mockIpcSocketService);

    client = new NativeMessagingClient(
      keyService,
      encryptService,
      cryptoFunctionService,
      appIdService,
      logService,
      accountService,
    );
  });

  describe("isDesktopAppAvailable", () => {
    it("should return false when socket does not exist", async () => {
      mockIpcSocketService.isSocketAvailable.mockResolvedValue(false);

      const result = await client.isDesktopAppAvailable();

      expect(result).toBe(false);
      expect(mockIpcSocketService.isSocketAvailable).toHaveBeenCalled();
    });

    it("should return true when socket exists", async () => {
      mockIpcSocketService.isSocketAvailable.mockResolvedValue(true);

      const result = await client.isDesktopAppAvailable();

      expect(result).toBe(true);
      expect(mockIpcSocketService.isSocketAvailable).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    it("should throw when connection fails", async () => {
      appIdService.getAppId.mockResolvedValue("test-app-id");
      mockIpcSocketService.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow("Connection failed");
    });

    it("should connect successfully when desktop app is available", async () => {
      appIdService.getAppId.mockResolvedValue("test-app-id");
      mockIpcSocketService.connect.mockResolvedValue();

      await client.connect();

      expect(mockIpcSocketService.connect).toHaveBeenCalled();
      expect(mockIpcSocketService.onMessage).toHaveBeenCalled();
      expect(mockIpcSocketService.onDisconnect).toHaveBeenCalled();
    });

    it("should not reconnect if already connected", async () => {
      appIdService.getAppId.mockResolvedValue("test-app-id");
      mockIpcSocketService.connect.mockResolvedValue();

      await client.connect();
      await client.connect(); // Second call

      // Should only connect once
      expect(mockIpcSocketService.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect", () => {
    it("should disconnect from socket", () => {
      client.disconnect();

      expect(mockIpcSocketService.disconnect).toHaveBeenCalled();
    });
  });
});
