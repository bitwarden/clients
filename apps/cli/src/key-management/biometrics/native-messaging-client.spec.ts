import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { IpcSocketService } from "./ipc-socket.service";
import { NativeMessagingClient } from "./native-messaging-client";

// Mock only the IPC boundary - everything else uses real implementations where possible
jest.mock("./ipc-socket.service");

describe("NativeMessagingClient", () => {
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let appIdService: MockProxy<AppIdService>;
  let keyService: MockProxy<KeyService>;
  let accountService: MockProxy<AccountService>;
  let mockIpcSocket: jest.Mocked<IpcSocketService>;
  let client: NativeMessagingClient;

  const mockUserId = "mock-user-id" as UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    cryptoFunctionService = mock<CryptoFunctionService>();
    appIdService = mock<AppIdService>();
    appIdService.getAppId.mockResolvedValue("test-app-id");
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();

    // Mock active account
    accountService.activeAccount$ = new BehaviorSubject({
      id: mockUserId,
      email: "test@example.com",
    }).asObservable() as any;

    // Mock only the IPC socket boundary
    mockIpcSocket = {
      isSocketAvailable: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      onMessage: jest.fn(),
      onDisconnect: jest.fn(),
      sendMessage: jest.fn(),
      getSocketPath: jest.fn(),
    } as unknown as jest.Mocked<IpcSocketService>;

    (IpcSocketService as jest.Mock).mockImplementation(() => mockIpcSocket);

    client = new NativeMessagingClient(
      keyService,
      mock<EncryptService>(),
      cryptoFunctionService,
      appIdService,
      mock<LogService>(),
      accountService,
    );
  });

  describe("connection lifecycle", () => {
    it("checks socket availability", async () => {
      mockIpcSocket.isSocketAvailable.mockResolvedValue(true);
      expect(await client.isDesktopAppAvailable()).toBe(true);

      mockIpcSocket.isSocketAvailable.mockResolvedValue(false);
      expect(await client.isDesktopAppAvailable()).toBe(false);
    });

    it("connects and sets up handlers", async () => {
      await client.connect();

      expect(mockIpcSocket.connect).toHaveBeenCalled();
      expect(mockIpcSocket.onMessage).toHaveBeenCalled();
      expect(mockIpcSocket.onDisconnect).toHaveBeenCalled();
    });

    it("only connects once", async () => {
      await client.connect();
      await client.connect();

      expect(mockIpcSocket.connect).toHaveBeenCalledTimes(1);
    });

    it("disconnects", () => {
      client.disconnect();
      expect(mockIpcSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe("message handling", () => {
    let messageHandler: (message: unknown) => void;

    beforeEach(async () => {
      mockIpcSocket.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      // Set up crypto for encryption handshake
      cryptoFunctionService.rsaGenerateKeyPair.mockResolvedValue([
        new Uint8Array(32),
        new Uint8Array(32),
      ]);

      await client.connect();
    });

    describe("wrongUserId", () => {
      it("rejects pending operations and disconnects", async () => {
        // Start an operation that triggers secureCommunication
        const operation = (client as any).secureCommunication();
        await new Promise((r) => setImmediate(r));

        // Desktop sends wrongUserId (doesn't include messageId - this is the bug we fixed)
        messageHandler({ command: "wrongUserId", appId: "test-app-id" });

        await expect(operation).rejects.toThrow("Account mismatch");
        expect(mockIpcSocket.disconnect).toHaveBeenCalled();
      });
    });

    describe("invalidateEncryption", () => {
      it("rejects pending operations and disconnects", async () => {
        const operation = (client as any).secureCommunication();
        await new Promise((r) => setImmediate(r));

        messageHandler({ command: "invalidateEncryption", appId: "test-app-id" });

        await expect(operation).rejects.toThrow("invalidated");
        expect(mockIpcSocket.disconnect).toHaveBeenCalled();
      });

      it("ignores messages for other apps", async () => {
        const operation = (client as any).secureCommunication();
        await new Promise((r) => setImmediate(r));

        // Message for different app - should be ignored
        messageHandler({ command: "invalidateEncryption", appId: "other-app-id" });

        // Operation should still be pending (not rejected)
        // We can't easily test this without timeout, so just verify disconnect wasn't called
        expect(mockIpcSocket.disconnect).not.toHaveBeenCalled();

        // Clean up - send the real message to complete the test
        messageHandler({ command: "wrongUserId", appId: "test-app-id" });
        await expect(operation).rejects.toThrow();
      });
    });

    describe("disconnected", () => {
      it("disconnects the socket", () => {
        messageHandler({ command: "disconnected" });

        expect(mockIpcSocket.disconnect).toHaveBeenCalled();
      });
    });

    describe("verifyDesktopIPCFingerprint", () => {
      it("displays fingerprint for verification when secure channel exists", async () => {
        const mockFingerprint = ["word1", "word2", "word3", "word4", "word5"];
        keyService.getFingerprint.mockResolvedValue(mockFingerprint);

        // Set up a secure channel with a public key
        (client as any).secureChannel = {
          publicKey: new Uint8Array(32),
        };

        messageHandler({ command: "verifyDesktopIPCFingerprint" });
        await new Promise((r) => setImmediate(r));

        expect(keyService.getFingerprint).toHaveBeenCalledWith(
          "test-app-id",
          expect.any(Uint8Array),
        );
      });
    });
  });

  describe("onDisconnect handler", () => {
    it("rejects all pending callbacks", async () => {
      let disconnectHandler: () => void;
      mockIpcSocket.onDisconnect.mockImplementation((handler) => {
        disconnectHandler = handler;
      });

      await client.connect();

      // Add pending callbacks
      const callbacks = (client as any).callbacks as Map<number, any>;
      const errors: Error[] = [];

      for (let i = 0; i < 3; i++) {
        callbacks.set(i, {
          resolver: jest.fn(),
          rejecter: (e: Error) => errors.push(e),
          timeout: setTimeout(() => {}, 60000),
        });
      }

      disconnectHandler!();

      expect(errors).toHaveLength(3);
      expect(errors[0].message).toContain("Disconnected");
      expect(callbacks.size).toBe(0);
    });
  });
});
