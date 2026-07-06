import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, of, take, timeout, timer } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountInfoWith, FakeAccountService } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService, BiometricsCommands } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { BiometricMessageHandlerService } from "./biometric-message-handler.service";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts = {
  [SomeUser]: mockAccountInfoWith({
    name: "some user",
    email: "some.user@example.com",
  }),
  [AnotherUser]: mockAccountInfoWith({
    name: "some other user",
    email: "some.other.user@example.com",
  }),
};

describe("BiometricMessageHandlerService", () => {
  let service: BiometricMessageHandlerService;

  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;
  let desktopSettingsService: DesktopSettingsService;
  let biometricsService: MockProxy<BiometricsService>;
  let accountService: AccountService;
  let authService: MockProxy<AuthService>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();
    desktopSettingsService = mock<DesktopSettingsService>();
    biometricsService = mock<BiometricsService>();
    accountService = new FakeAccountService(accounts);
    authService = mock<AuthService>();

    desktopSettingsService.browserIntegrationEnabled$ = of(false);

    (global as any).ipc = {
      platform: {
        ephemeralStore: {
          listEphemeralValueKeys: jest.fn(() => Promise.resolve([])),
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
    cryptoFunctionService.randomBytes.mockResolvedValue(new Uint8Array(64) as CsprngArray);
    cryptoFunctionService.rsaEncrypt.mockResolvedValue(
      Utils.fromUtf8ToArray("encrypted") as CsprngArray,
    );
    service = new BiometricMessageHandlerService(
      cryptoFunctionService,
      encryptService,
      logService,
      desktopSettingsService,
      biometricsService,
      accountService,
      authService,
    );
  });

  describe("constructor", () => {
    let browserIntegrationEnabled = new BehaviorSubject<boolean>(true);

    beforeEach(async () => {
      (global as any).ipc = {
        platform: {
          ephemeralStore: {
            listEphemeralValueKeys: jest.fn(() =>
              Promise.resolve(["connectedApp_appId1", "connectedApp_appId2"]),
            ),
            getEphemeralValue: jest.fn((key) => {
              if (key === "connectedApp_appId1") {
                return Promise.resolve(
                  JSON.stringify({
                    publicKey: Utils.fromUtf8ToB64("publicKeyApp1"),
                    sessionSecret: Utils.fromUtf8ToB64("sessionSecretApp1"),
                    trusted: true,
                  }),
                );
              } else if (key === "connectedApp_appId2") {
                return Promise.resolve(
                  JSON.stringify({
                    publicKey: Utils.fromUtf8ToB64("publicKeyApp2"),
                    sessionSecret: Utils.fromUtf8ToB64("sessionSecretApp2"),
                    trusted: false,
                  }),
                );
              }
              return Promise.resolve(null);
            }),
            removeEphemeralValue: jest.fn(),
            setEphemeralValue: jest.fn(),
          },
        },
      };

      desktopSettingsService.browserIntegrationEnabled$ = browserIntegrationEnabled.asObservable();

      service = new BiometricMessageHandlerService(
        cryptoFunctionService,
        encryptService,
        logService,
        desktopSettingsService,
        biometricsService,
        accountService,
        authService,
      );
    });

    afterEach(() => {
      browserIntegrationEnabled = new BehaviorSubject<boolean>(true);

      desktopSettingsService.browserIntegrationEnabled$ = browserIntegrationEnabled.asObservable();
    });

    it("should clear connected apps when browser integration disabled", async () => {
      browserIntegrationEnabled.next(false);

      await firstValueFrom(
        timer(0, 100).pipe(
          filter(
            () =>
              (global as any).ipc.platform.ephemeralStore.removeEphemeralValue.mock.calls.length ==
              2,
          ),
          take(1),
          timeout(1000),
        ),
      );

      expect((global as any).ipc.platform.ephemeralStore.removeEphemeralValue).toHaveBeenCalledWith(
        "connectedApp_appId1",
      );
      expect((global as any).ipc.platform.ephemeralStore.removeEphemeralValue).toHaveBeenCalledWith(
        "connectedApp_appId2",
      );
    });
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

    it("should not attempt to verify when the connected app is already trusted", async () => {
      (global as any).ipc.platform.ephemeralStore.listEphemeralValueKeys.mockResolvedValue([
        "connectedApp_appId",
      ]);
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(
        JSON.stringify({
          publicKey: Utils.fromUtf8ToB64("publicKey"),
          sessionSecret: Utils.fromBufferToB64(new Uint8Array(64)),
        }),
      );
      encryptService.decryptString.mockResolvedValue(
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
      expect((global as any).ipc.platform.nativeMessaging.sendMessage).not.toHaveBeenCalledWith({
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
