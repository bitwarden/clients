import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { BrowserApi } from "../../platform/browser/browser-api";
import { PopupViewCacheBackgroundService } from "../../platform/services/popup-view-cache-background.service";

import { BackgroundAccountSwitchService } from "./background-account-switch.service";
import { BackgroundLogoutService } from "./background-logout.service";
import { BackgroundRefresher } from "./background-refresher";

describe("BackgroundLogoutService", () => {
  const activeUserId = "active-user" as UserId;
  const backgroundUserId = "background-user" as UserId;
  const nextUserId = "next-user" as UserId;

  let logService: MockProxy<LogService>;
  let accountService: MockProxy<AccountService>;
  let accountSwitchService: MockProxy<BackgroundAccountSwitchService>;
  let authService: MockProxy<AuthService>;
  let eventUploadService: MockProxy<EventUploadService>;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<InternalFolderService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let popupViewCacheBackgroundService: MockProxy<PopupViewCacheBackgroundService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let keyService: MockProxy<KeyService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let messagingService: MockProxy<MessagingService>;
  let systemService: MockProxy<SystemService>;
  let processReloadService: MockProxy<ProcessReloadServiceAbstraction>;
  let backgroundRefresher: MockProxy<BackgroundRefresher>;
  let sdkService: MockProxy<SdkService>;

  let sut: BackgroundLogoutService;

  beforeEach(() => {
    jest.spyOn(BrowserApi, "isManifestVersion").mockReturnValue(false);

    logService = mock<LogService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: activeUserId } as Account);
    accountService.nextUpAccount$ = of({ id: nextUserId } as Account);
    accountSwitchService = mock<BackgroundAccountSwitchService>();
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));
    eventUploadService = mock<EventUploadService>();
    cipherService = mock<CipherService>();
    folderService = mock<InternalFolderService>();
    biometricStateService = mock<BiometricStateService>();
    popupViewCacheBackgroundService = mock<PopupViewCacheBackgroundService>();
    pinService = mock<PinServiceAbstraction>();
    keyService = mock<KeyService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(of(15));
    stateService = mock<StateService>();
    tokenService = mock<TokenService>();
    stateEventRunnerService = mock<StateEventRunnerService>();
    messagingService = mock<MessagingService>();
    systemService = mock<SystemService>();
    processReloadService = mock<ProcessReloadServiceAbstraction>();
    backgroundRefresher = mock<BackgroundRefresher>();
    sdkService = mock<SdkService>();

    sut = new BackgroundLogoutService(
      logService,
      accountService,
      accountSwitchService,
      authService,
      eventUploadService,
      cipherService,
      folderService,
      biometricStateService,
      popupViewCacheBackgroundService,
      pinService,
      keyService,
      vaultTimeoutSettingsService,
      stateService,
      tokenService,
      stateEventRunnerService,
      messagingService,
      systemService,
      processReloadService,
      backgroundRefresher,
      sdkService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs the user id and reason", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(logService.info).toHaveBeenCalledWith(
      "Logging out user %s for reason: %s",
      activeUserId,
      "userInitiated",
    );
  });

  it("disposes the SDK client before it switches accounts or clears the user's data", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(sdkService.logout).toHaveBeenCalledWith(activeUserId);
    const disposeOrder = sdkService.logout.mock.invocationCallOrder[0];
    expect(disposeOrder).toBeLessThan(
      accountSwitchService.switchAccount.mock.invocationCallOrder[0],
    );
    expect(disposeOrder).toBeLessThan(eventUploadService.uploadEvents.mock.invocationCallOrder[0]);
    expect(disposeOrder).toBeLessThan(keyService.clearKeys.mock.invocationCallOrder[0]);
  });

  it("switches to the next account when the active account logs out", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(accountSwitchService.switchAccount).toHaveBeenCalledWith(nextUserId);
  });

  it("switches to no account when a background account logs out", async () => {
    await sut.logout(backgroundUserId, "userInitiated");

    expect(accountSwitchService.switchAccount).toHaveBeenCalledWith(null);
  });

  it("uploads events and clears the user's data", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(eventUploadService.uploadEvents).toHaveBeenCalledWith(activeUserId);
    expect(cipherService.clear).toHaveBeenCalledWith(activeUserId);
    expect(folderService.clear).toHaveBeenCalledWith(activeUserId);
    expect(biometricStateService.logout).toHaveBeenCalledWith(activeUserId);
    expect(popupViewCacheBackgroundService.clearState).toHaveBeenCalled();
    expect(pinService.logout).toHaveBeenCalledWith(activeUserId);
    expect(keyService.clearKeys).toHaveBeenCalledWith(activeUserId);
    expect(stateService.clean).toHaveBeenCalledWith({ userId: activeUserId });
    expect(tokenService.clearTokens).toHaveBeenCalledWith(activeUserId);
    expect(accountService.clean).toHaveBeenCalledWith(activeUserId);
    expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("logout", activeUserId);
  });

  it("tells the popup that the logout is done, with the reason", async () => {
    await sut.logout(activeUserId, "sessionExpired");

    expect(messagingService.send).toHaveBeenCalledWith("doneLoggingOut", {
      logoutReason: "sessionExpired",
      userId: activeUserId,
    });
  });

  it("shows the locked context menu, clears the clipboard, and reloads the process", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(backgroundRefresher.refreshMenu).toHaveBeenCalledWith(true);
    expect(systemService.clearPendingClipboard).toHaveBeenCalled();
    expect(processReloadService.reloadProcess).toHaveBeenCalled();
  });

  it("returns undefined", async () => {
    const result = await sut.logout(activeUserId, "userInitiated");

    expect(result).toBeUndefined();
  });

  describe("storage reseed", () => {
    it("reseeds storage when the user's vault timeout is not Never", async () => {
      await sut.logout(activeUserId, "userInitiated");

      expect(backgroundRefresher.reseedStorage).toHaveBeenCalled();
    });

    it("does not reseed storage when the user's vault timeout is Never", async () => {
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        of(VaultTimeoutStringType.Never),
      );

      await sut.logout(activeUserId, "userInitiated");

      expect(backgroundRefresher.reseedStorage).not.toHaveBeenCalled();
    });
  });

  describe("updateBadge message", () => {
    it("sends updateBadge in manifest v3", async () => {
      jest.spyOn(BrowserApi, "isManifestVersion").mockReturnValue(true);
      const sendMessageSpy = jest.spyOn(BrowserApi, "sendMessage").mockImplementation();

      await sut.logout(activeUserId, "userInitiated");

      expect(sendMessageSpy).toHaveBeenCalledWith("updateBadge");
    });

    it("does not send updateBadge in manifest v2", async () => {
      const sendMessageSpy = jest.spyOn(BrowserApi, "sendMessage").mockImplementation();

      await sut.logout(activeUserId, "userInitiated");

      expect(sendMessageSpy).not.toHaveBeenCalledWith("updateBadge");
    });
  });
});
