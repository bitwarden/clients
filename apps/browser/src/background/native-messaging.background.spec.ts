import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { BrowserApi } from "../platform/browser/browser-api";

import { NativeMessagingBackground } from "./nativeMessaging.background";

// Mock BrowserApi
jest.mock("../platform/browser/browser-api");

describe("NativeMessagingBackground", () => {
  let sut: NativeMessagingBackground;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let messagingService: MockProxy<MessagingService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let accountService: MockProxy<AccountService>;

  const mockAppId = "test-app-id";
  const mockUserId = "test-user-id" as UserId;
  const mockAccount: Account = {
    id: mockUserId,
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    creationDate: new Date(),
  };

  const mockSharedSecret = new SymmetricCryptoKey(new Uint8Array(64));
  const mockSecureChannel = {
    publicKey: new Uint8Array(64),
    privateKey: new Uint8Array(64),
    sharedSecret: mockSharedSecret,
  };

  function expectDisconnectedState() {
    expect(sut.connected).toBe(false);
    expect((sut as any).connecting).toBe(false);
    expect((sut as any).secureChannel).toBeUndefined();
  }

  function setCallback(id: number, rejecter: jest.Mock) {
    (sut as any).callbacks.set(id, { resolver: jest.fn(), rejecter });
  }

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    messagingService = mock<MessagingService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    logService = mock<LogService>();
    biometricStateService = mock<BiometricStateService>();
    accountService = mock<AccountService>();

    appIdService.getAppId.mockResolvedValue(mockAppId);
    accountService.activeAccount$ = of(mockAccount);
    platformUtilsService.isSafari.mockReturnValue(false);

    (BrowserApi.permissionsGranted as jest.Mock).mockResolvedValue(true);
    (BrowserApi.connectNative as jest.Mock).mockReturnValue({
      onMessage: {
        addListener: jest.fn(),
      },
      onDisconnect: {
        addListener: jest.fn(),
      },
      postMessage: jest.fn(),
      disconnect: jest.fn(),
    });

    sut = new NativeMessagingBackground(
      keyService,
      encryptService,
      cryptoFunctionService,
      messagingService,
      appIdService,
      platformUtilsService,
      logService,
      biometricStateService,
      accountService,
    );
  });

  describe("constructor", () => {
    it("creates instance with expected values", () => {
      expect(sut).toBeDefined();
      expect(sut.connected).toBe(false);
      expect((sut as any).connecting).toBe(false);
    });
  });

  describe("connect", () => {
    it("logs warning and returns if native messaging permission is missing", async () => {
      (BrowserApi.permissionsGranted as jest.Mock).mockResolvedValue(false);

      await sut.connect();

      expect(logService.warning).toHaveBeenCalledWith(
        "[Native Messaging IPC] Native messaging permission is missing for biometrics",
      );
      expect(sut.connected).toBe(false);
    });

    it("connects immediately for Safari", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);

      await sut.connect();

      expect(sut.connected).toBe(true);
      expect(logService.info).toHaveBeenCalledWith(
        "[Native Messaging IPC] Connection to Safari swift module established!",
      );
    });
  });

  describe("port listeners", () => {
    let connectPromise: Promise<void>;
    let messageListener: (msg: unknown) => Promise<void>;
    let disconnectListener: (p: any) => void;
    let mockPort: {
      onMessage: { addListener: jest.Mock };
      onDisconnect: { addListener: jest.Mock };
      postMessage: jest.Mock;
      disconnect: jest.Mock;
    };

    beforeEach(async () => {
      mockPort = {
        onMessage: {
          addListener: jest.fn((fn) => {
            messageListener = fn;
          }),
        },
        onDisconnect: {
          addListener: jest.fn((fn) => {
            disconnectListener = fn;
          }),
        },
        postMessage: jest.fn(),
        disconnect: jest.fn(),
      };
      (BrowserApi.connectNative as jest.Mock).mockReturnValue(mockPort);
      platformUtilsService.isSafari.mockReturnValue(false);

      connectPromise = sut.connect() as Promise<void>;
    });

    afterEach(() => {
      (chrome.runtime as any).lastError = undefined;
      (BrowserApi as any).isWebExtensionsApi = undefined;
    });

    describe("port.onMessage listener", () => {
      describe("'connected' command", () => {
        it("sets expected internal state values", async () => {
          await messageListener({ command: "connected" });

          expect(sut.connected).toBe(true);
          expect((sut as any).connecting).toBe(false);
          expect(logService.info).toHaveBeenCalledWith(
            "[Native Messaging IPC] Connection to Bitwarden Desktop app established!",
          );
        });
      });

      describe("'disconnected' command", () => {
        it("logs disconnection info message", async () => {
          await messageListener({ command: "disconnected" });

          expect(logService.info).toHaveBeenCalledWith(
            "[Native Messaging IPC] Disconnected from Bitwarden Desktop app.",
          );
        });

        it("rejects with Error('startDesktop') when still connecting", async () => {
          await messageListener({ command: "disconnected" });

          await expect(connectPromise).rejects.toThrow("startDesktop");
        });

        it("does not reject connect() Promise with startDesktop when not connecting", async () => {
          (sut as any).connecting = false;

          await messageListener({ command: "disconnected" });

          const result = await Promise.race([
            connectPromise.then(
              () => "resolved",
              (e: Error) => `rejected:${e.message}`,
            ),
            Promise.resolve("pending"),
          ]);

          expect(result).toBe("pending");
        });

        it("calls disconnect() to clean up internal state", async () => {
          const disconnectSpy = jest.spyOn(sut as any, "disconnect");

          await messageListener({ command: "disconnected" });

          expect(disconnectSpy).toHaveBeenCalled();
          expectDisconnectedState();
          expect(mockPort.disconnect).toHaveBeenCalled();
        });

        it("rejects all pending callbacks with 'disconnected' and clears internal callbacks", async () => {
          const rejecter1 = jest.fn();
          const rejecter2 = jest.fn();
          setCallback(1, rejecter1);
          setCallback(2, rejecter2);

          await messageListener({ command: "disconnected" });

          expect(rejecter1).toHaveBeenCalledWith("disconnected");
          expect(rejecter2).toHaveBeenCalledWith("disconnected");
          expect((sut as any).callbacks.size).toBe(0);
        });

        it("clears callbacks even when none are pending", async () => {
          const clearSpy = jest.spyOn((sut as any).callbacks, "clear");

          await messageListener({ command: "disconnected" });

          expect(clearSpy).toHaveBeenCalled();
          expect((sut as any).callbacks.size).toBe(0);
        });
      });

      describe("'invalidateEncryption' command", () => {
        it("ignores message with non-matching appId", async () => {
          const disconnectSpy = jest.spyOn(sut as any, "disconnect");

          await messageListener({ command: "invalidateEncryption", appId: "other-app-id" });

          expect(logService.warning).not.toHaveBeenCalled();
          expect(disconnectSpy).not.toHaveBeenCalled();
        });

        it("logs warning when appId matches", async () => {
          await messageListener({ command: "invalidateEncryption", appId: mockAppId });

          expect(logService.warning).toHaveBeenCalledWith(
            "[Native Messaging IPC] Secure channel encountered an error; disconnecting and wiping keys...",
          );
        });

        it("calls disconnect() to clean up internal state", async () => {
          const disconnectSpy = jest.spyOn(sut as any, "disconnect");

          await messageListener({ command: "invalidateEncryption", appId: mockAppId });

          expect(disconnectSpy).toHaveBeenCalled();
          expectDisconnectedState();
          expect(mockPort.disconnect).toHaveBeenCalled();
        });

        it("rejects the matching callback with invalidateEncryption error", async () => {
          const rejecter = jest.fn();
          setCallback(1, rejecter);

          await messageListener({
            command: "invalidateEncryption",
            appId: mockAppId,
            messageId: 1,
          });

          expect(rejecter).toHaveBeenCalledWith({ message: "invalidateEncryption" });
        });

        it("does not reject a callback with a non-matching messageId", async () => {
          const rejecter = jest.fn();
          setCallback(2, rejecter);

          await messageListener({
            command: "invalidateEncryption",
            appId: mockAppId,
            messageId: 1,
          });

          expect(rejecter).not.toHaveBeenCalled();
        });

        it("does not reject any callback when messageId is absent", async () => {
          const rejecter = jest.fn();
          setCallback(1, rejecter);

          await messageListener({ command: "invalidateEncryption", appId: mockAppId });

          expect(rejecter).not.toHaveBeenCalled();
        });
      });
    });

    describe("port.onDisconnect listener", () => {
      beforeEach(() => {
        (BrowserApi as any).isWebExtensionsApi = true;
      });

      it("reads error message from listener on WebExtensions API", async () => {
        disconnectListener({ error: { message: "webext error" } });

        expect(logService.error).toHaveBeenCalledWith(
          "NativeMessaging port disconnected because of error: webext error",
        );
      });

      it("reads error message from chrome runtime on Chrome API", async () => {
        (BrowserApi as any).isWebExtensionsApi = false;
        (chrome.runtime as any).lastError = { message: "chrome error" };

        disconnectListener({});

        expect(logService.error).toHaveBeenCalledWith(
          "NativeMessaging port disconnected because of error: chrome error",
        );
      });

      it("clears secureChannel, connected, and connecting", async () => {
        (sut as any).connected = true;
        (sut as any).connecting = true;
        (sut as any).secureChannel = mockSecureChannel;

        disconnectListener({ error: { message: "error" } });

        expectDisconnectedState();
      });

      it("rejects with 'desktopIntegrationDisabled' when error is present", async () => {
        disconnectListener({ error: { message: "some error" } });

        await expect(connectPromise).rejects.toThrow("desktopIntegrationDisabled");
      });

      it("rejects with an empty message when no error is present", async () => {
        disconnectListener({ error: { message: undefined } });

        const err = await connectPromise.catch((e: Error) => e);
        expect(err instanceof Error ? err.message : "").toBe("");
      });
    });
  });

  describe("encryptMessage", () => {
    it("encrypts message with existing shared secret", async () => {
      const mockEncryptedString = new EncString("encrypted-data");

      (sut as any).secureChannel = mockSecureChannel;

      encryptService.encryptString.mockResolvedValue(mockEncryptedString);

      const message = { command: "test", userId: mockUserId, timestamp: Date.now() };
      const result = await sut.encryptMessage(message);

      expect(encryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(message),
        mockSharedSecret,
      );
      expect(result).toBe(mockEncryptedString);
    });
  });

  describe("send", () => {
    const message: any = { command: "test" };

    beforeEach(() => {
      platformUtilsService.isSafari.mockReturnValue(true);
      jest.spyOn(sut as any, "connect").mockResolvedValue(undefined);
      jest.spyOn(sut as any, "postMessage").mockImplementation(() => {});
    });

    it("connects before sending if not already connected", async () => {
      sut.connected = false;

      await sut.send(message);

      expect((sut as any).connect).toHaveBeenCalled();
      expect((sut as any).postMessage).toHaveBeenCalledWith(message);
    });

    it("adds user ID and timestamp to message", async () => {
      (sut as any).connected = true;

      await sut.send(message);

      expect(message.userId).toBe(mockUserId);
      expect(message.timestamp).toBeDefined();
    });

    describe("with mock port", () => {
      let mockPort: {
        postMessage: jest.Mock;
        disconnect: jest.Mock;
      };
      const mockEncString = new EncString("2.testIv|testData|testMac");

      beforeEach(() => {
        // Restore the postMessage spy set up in the outer beforeEach so the real implementation runs
        jest.restoreAllMocks();

        mockPort = {
          postMessage: jest.fn(),
          disconnect: jest.fn(),
        };
        (sut as any).port = mockPort;
        (sut as any).connected = true;
        (sut as any).appId = mockAppId;
      });

      describe("non-Safari path", () => {
        beforeEach(() => {
          platformUtilsService.isSafari.mockReturnValue(false);
          (sut as any).secureChannel = mockSecureChannel;
          encryptService.encryptString.mockResolvedValue(mockEncString);
        });

        it("calls port.postMessage with expected msg", async () => {
          await sut.send({ command: "test" });

          const postedMsg = mockPort.postMessage.mock.calls[0][0];
          expect(postedMsg.message).toEqual({
            encryptedString: mockEncString.encryptedString,
            encryptionType: mockEncString.encryptionType,
            data: mockEncString.data,
            iv: mockEncString.iv,
            mac: mockEncString.mac,
          });
          expect(postedMsg.appId).toBe(mockAppId);
        });

        it("handles error when port.postMessage throws", async () => {
          mockPort.postMessage.mockImplementation(() => {
            throw new Error("port disconnected");
          });

          await expect(sut.send({ command: "test" })).resolves.toBeUndefined();

          expect(logService.info).toHaveBeenCalledWith(
            "[Native Messaging IPC] Disconnected from Bitwarden Desktop app because of the native port disconnecting.",
          );
          expectDisconnectedState();
          expect(mockPort.disconnect).toHaveBeenCalled();
        });
      });

      describe("Safari path", () => {
        beforeEach(() => {
          platformUtilsService.isSafari.mockReturnValue(true);
        });

        it("calls port.postMessage with the plain message object (no EncString)", async () => {
          const safariMessage: any = { command: "test" };
          await sut.send(safariMessage);

          expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
          expect(mockPort.postMessage.mock.calls[0][0]).not.toHaveProperty("appId");
          expect(mockPort.postMessage.mock.calls[0][0].command).toBe("test");
        });
      });
    });
  });
});
