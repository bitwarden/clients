import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutService } from "@bitwarden/common/auth/logout";
import {
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { LockService, LockSource } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { BrowserApi } from "../platform/browser/browser-api";

import IdleBackground from "./idle.background";
import { SYSTEM_LOCKED } from "./idle.background.messages";

const USER_ID = "00000000-0000-0000-0000-000000000001" as UserId;
const EXTENSION_PAGE = { origin: "chrome-extension://id" } as chrome.runtime.MessageSender;

type IdleListener = (newState: string) => unknown;
type ExtensionMessageListener = (
  message: { command?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

/** Lets the asynchronous work started by a listener finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("IdleBackground", () => {
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let lockService: MockProxy<LockService>;
  let logoutService: MockProxy<LogoutService>;
  let idleListeners: IdleListener[];
  let extensionMessageListener: ExtensionMessageListener;

  beforeEach(() => {
    idleListeners = [];
    (chrome as unknown as { idle?: object }).idle = {
      setDetectionInterval: jest.fn(),
      onStateChanged: { addListener: (listener: IdleListener) => idleListeners.push(listener) },
    };
    jest
      .spyOn(BrowserApi, "messageListener")
      .mockImplementation((_name, listener) => (extensionMessageListener = listener));

    accountService = mock<AccountService>();
    accountService.accounts$ = of({ [USER_ID]: mock<AccountInfo>() } as Record<
      UserId,
      AccountInfo
    >);
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    vaultTimeoutSettingsService.isVaultTimeoutSuppressed.mockResolvedValue(false);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.LogOut),
    );
    lockService = mock<LockService>();
    logoutService = mock<LogoutService>();

    new IdleBackground(
      mock<VaultTimeoutService>(),
      mock<ServerNotificationsService>(),
      accountService,
      vaultTimeoutSettingsService,
      lockService,
      logoutService,
      authService,
      mock<LogService>(),
    ).init();
  });

  afterEach(() => {
    delete (chrome as unknown as { idle?: object }).idle;
    jest.restoreAllMocks();
  });

  describe("screen lock", () => {
    const lockScreen = () => Promise.all(idleListeners.map((listener) => listener("locked")));

    it("logs out an account with the Log out timeout action", async () => {
      await lockScreen();

      expect(logoutService.logout).toHaveBeenCalledWith(USER_ID, "vaultTimeout");
      expect(lockService.lock).not.toHaveBeenCalled();
    });

    it("locks an account with the Lock timeout action", async () => {
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
        of(VaultTimeoutAction.Lock),
      );

      await lockScreen();

      expect(lockService.lock).toHaveBeenCalledWith(USER_ID, LockSource.VaultTimeout);
      expect(logoutService.logout).not.toHaveBeenCalled();
    });

    it("does not evaluate the timeout action of a logged out account", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));

      await lockScreen();

      expect(vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$).not.toHaveBeenCalled();
      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(lockService.lock).not.toHaveBeenCalled();
    });

    it("skips an account whose vault timeout is suppressed", async () => {
      vaultTimeoutSettingsService.isVaultTimeoutSuppressed.mockResolvedValue(true);

      await lockScreen();

      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(lockService.lock).not.toHaveBeenCalled();
    });

    it("skips an account whose vault timeout is not On system lock", async () => {
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        of(VaultTimeoutStringType.OnRestart),
      );

      await lockScreen();

      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(lockService.lock).not.toHaveBeenCalled();
    });
  });

  describe("system locked request", () => {
    it("answers an extension page once the timeout is applied", async () => {
      jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(true);
      const sendResponse = jest.fn();

      const keepsChannelOpen = extensionMessageListener(
        { command: SYSTEM_LOCKED },
        EXTENSION_PAGE,
        sendResponse,
      );
      await settle();

      expect(keepsChannelOpen).toBe(true);
      expect(logoutService.logout).toHaveBeenCalledWith(USER_ID, "vaultTimeout");
      expect(sendResponse).toHaveBeenCalledWith({});
    });

    it("answers with the error when applying the timeout fails", async () => {
      jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(true);
      logoutService.logout.mockRejectedValue(new Error("logout failed"));
      const sendResponse = jest.fn();

      extensionMessageListener({ command: SYSTEM_LOCKED }, EXTENSION_PAGE, sendResponse);
      await settle();

      expect(sendResponse).toHaveBeenCalledWith({ error: { message: "logout failed" } });
    });

    it("ignores a content script", async () => {
      jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(false);
      const sendResponse = jest.fn();

      const keepsChannelOpen = extensionMessageListener(
        { command: SYSTEM_LOCKED },
        { origin: "https://example.test" } as chrome.runtime.MessageSender,
        sendResponse,
      );
      await settle();

      expect(keepsChannelOpen).toBeUndefined();
      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
