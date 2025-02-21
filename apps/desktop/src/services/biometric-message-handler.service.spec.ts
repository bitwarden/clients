import { NgZone } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, I18nMockService } from "@bitwarden/components";
import {
  KeyService,
  BiometricsService,
  BiometricStateService,
  BiometricsCommands,
} from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { BiometricMessageHandlerService } from "./biometric-message-handler.service";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts: Record<UserId, AccountInfo> = {
  [SomeUser]: {
    name: "some user",
    email: "some.user@example.com",
    emailVerified: true,
  },
  [AnotherUser]: {
    name: "some other user",
    email: "some.other.user@example.com",
    emailVerified: true,
  },
};

describe("BiometricMessageHandlerService", () => {
  let service: BiometricMessageHandlerService;

  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;
  let messagingService: MockProxy<MessagingService>;
  let desktopSettingsService: DesktopSettingsService;
  let biometricStateService: BiometricStateService;
  let biometricsService: MockProxy<BiometricsService>;
  let dialogService: MockProxy<DialogService>;
  let accountService: AccountService;
  let authService: MockProxy<AuthService>;
  let ngZone: MockProxy<NgZone>;
  let i18nService: MockProxy<I18nMockService>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();
    messagingService = mock<MessagingService>();
    desktopSettingsService = mock<DesktopSettingsService>();
    biometricStateService = mock<BiometricStateService>();
    biometricsService = mock<BiometricsService>();
    dialogService = mock<DialogService>();

    accountService = new FakeAccountService(accounts);
    authService = mock<AuthService>();
    ngZone = mock<NgZone>();
    i18nService = mock<I18nMockService>();

    (global as any).ipc = {
      platform: {
        ephemeralStore: {
          listEphemeralValueKeys: jest.fn(),
          getEphemeralValue: jest.fn(),
          removeEphemeralValue: jest.fn(),
          setEphemeralValue: jest.fn(),
        },
        nativeMessaging: {
          sendMessage: jest.fn(),
        },
        reloadProcess: jest.fn(),
      },
    };
    cryptoFunctionService.rsaEncrypt.mockResolvedValue(Utils.fromUtf8ToArray("encrypted"));
    cryptoFunctionService.randomBytes.mockResolvedValue(new Uint8Array(64) as CsprngArray);

    service = new BiometricMessageHandlerService(
      cryptoFunctionService,
      keyService,
      encryptService,
      logService,
      messagingService,
      desktopSettingsService,
      biometricStateService,
      biometricsService,
      dialogService,
      accountService,
      authService,
      ngZone,
      i18nService,
    );
  });

  describe("setup encryption", () => {
    it("should ignore when public key missing in message", async () => {
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "setupEncryption",
          messageId: 0,
          userId: "unknownUser" as UserId,
        },
      });
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).not.toHaveBeenCalled();
    });

    it("should ignore when user id missing in message", async () => {
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "setupEncryption",
          messageId: 0,
          publicKey: Utils.fromUtf8ToB64("publicKey"),
        },
      });
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).not.toHaveBeenCalled();
    });

    it("should reject when user is not in app", async () => {
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "setupEncryption",
          messageId: 0,
          userId: "unknownUser" as UserId,
          publicKey: Utils.fromUtf8ToB64("publicKey"),
        },
      });
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        appId: "appId",
        command: "wrongUserId",
      });
    });

    it("should setup secure communication", async () => {
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: null,
          trusted: false,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "setupEncryption",
          messageId: 0,
          userId: SomeUser,
          publicKey: Utils.fromUtf8ToB64("publicKey"),
        },
      });
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        appId: "appId",
        command: "setupEncryption",
        messageId: -1,
        sharedSecret: Utils.fromUtf8ToB64("encrypted"),
      });
      expect((global as any).ipc.platform.ephemeralStore.setEphemeralValue).toHaveBeenCalledWith(
        "connectedApp_appId",
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: false,
        }),
      );
    });

    it("should invalidate encryption if connection is not secured", async () => {
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: null,
          trusted: false,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "biometricUnlock",
          messageId: 0,
          userId: SomeUser,
        },
      });
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        appId: "appId",
        command: "invalidateEncryption",
      });
    });

    it("should show update dialog when legacy unlock is requested with fingerprint active", async () => {
      desktopSettingsService.browserIntegrationFingerprintEnabled$ = of(true);
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: false,
        }),
      );
      encryptService.decryptToUtf8.mockResolvedValue(
        JSON.stringify({
          command: "biometricUnlock",
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: "biometricUnlock",
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        },
      });
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
    });

    it("should send verify fingerprint when fingerprinting is required on modern unlock, and dialog is accepted, and set to trusted", async () => {
      desktopSettingsService.browserIntegrationFingerprintEnabled$ = of(true);
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: false,
        }),
      );
      ngZone.run.mockReturnValue({
        closed: of(true),
      });
      encryptService.decryptToUtf8.mockResolvedValue(
        JSON.stringify({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        },
      });

      expect(ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        command: "verifyDesktopIPCFingerprint",
        appId: "appId",
      });
      expect(ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        command: "verifiedDesktopIPCFingerprint",
        appId: "appId",
      });
      expect(ipc.platform.ephemeralStore.setEphemeralValue).toHaveBeenCalledWith(
        "connectedApp_appId",
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: true,
        }),
      );
    });

    it("should send reject fingerprint when fingerprinting is required on modern unlock, and dialog is rejected, and it should not set to trusted", async () => {
      desktopSettingsService.browserIntegrationFingerprintEnabled$ = of(true);
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: false,
        }),
      );
      ngZone.run.mockReturnValue({
        closed: of(false),
      });
      encryptService.decryptToUtf8.mockResolvedValue(
        JSON.stringify({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        },
      });
      expect(ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        command: "verifyDesktopIPCFingerprint",
        appId: "appId",
      });
      expect(ipc.platform.nativeMessaging.sendMessage).toHaveBeenCalledWith({
        command: "rejectedDesktopIPCFingerprint",
        appId: "appId",
      });
      expect(ipc.platform.ephemeralStore.setEphemeralValue).not.toHaveBeenCalledWith(
        "connectedApp_appId",
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: true,
        }),
      );
    });

    it("should not attempt to verify when the connected app is already trusted", async () => {
      desktopSettingsService.browserIntegrationFingerprintEnabled$ = of(true);
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
          trusted: true,
        }),
      );
      encryptService.decryptToUtf8.mockResolvedValue(
        JSON.stringify({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        }),
      );
      await service.handleMessage({
        appId: "appId",
        message: {
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 0,
          timestamp: Date.now(),
          userId: SomeUser,
        },
      });
      expect(ipc.platform.nativeMessaging.sendMessage).not.toHaveBeenCalledWith({
        command: "verifyDesktopIPCFingerprint",
        appId: "appId",
      });
    });
  });

  describe("process reload", () => {
    const testCases = [
      // don't reload when the active user is the requested one and unlocked
      [SomeUser, AuthenticationStatus.Unlocked, SomeUser, false, false],
      // do reload when the active user is the requested one but locked
      [SomeUser, AuthenticationStatus.Locked, SomeUser, false, true],
      // always reload when another user is active than the requested one
      [SomeUser, AuthenticationStatus.Unlocked, AnotherUser, false, true],
      [SomeUser, AuthenticationStatus.Locked, AnotherUser, false, true],
      // don't reload when no active user
      [null, AuthenticationStatus.Unlocked, AnotherUser, false, false],

      // don't reload in dev mode
      [SomeUser, AuthenticationStatus.Unlocked, SomeUser, true, false],
      [SomeUser, AuthenticationStatus.Locked, SomeUser, true, false],
      [SomeUser, AuthenticationStatus.Unlocked, AnotherUser, true, false],
      [SomeUser, AuthenticationStatus.Locked, AnotherUser, true, false],
      [null, AuthenticationStatus.Unlocked, AnotherUser, true, false],
    ];

    it.each(testCases)(
      "process reload for active user %s with auth status %s and other user %s and isdev: %s should process reload: %s",
      async (activeUser, authStatus, messageUser, isDev, shouldReload) => {
        await accountService.switchAccount(activeUser as UserId);
        authService.authStatusFor$.mockReturnValue(of(authStatus as AuthenticationStatus));
        (global as any).ipc.platform.isDev = isDev;
        (global as any).ipc.platform.reloadProcess.mockClear();
        await service.processReloadWhenRequired(messageUser as UserId);

        if (shouldReload) {
          expect((global as any).ipc.platform.reloadProcess).toHaveBeenCalled();
        } else {
          expect((global as any).ipc.platform.reloadProcess).not.toHaveBeenCalled();
        }
      },
    );
  });
});
