import { NgZone } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FakeAccountService } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { KeyService, BiometricsService, BiometricStateService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { BiometricMessageHandlerService } from "./biometric-message-handler.service";

(global as any).ipc = {
  platform: {
    reloadProcess: jest.fn(),
  },
};

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts = {
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
    );
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

      // don't reload in dev mode
      [SomeUser, AuthenticationStatus.Unlocked, SomeUser, true, false],
      [SomeUser, AuthenticationStatus.Locked, SomeUser, true, false],
      [SomeUser, AuthenticationStatus.Unlocked, AnotherUser, true, false],
      [SomeUser, AuthenticationStatus.Locked, AnotherUser, true, false],
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
