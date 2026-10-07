import { DestroyRef, NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { EMPTY, of } from "rxjs";

import { AccountDeletionService } from "@bitwarden/angular/auth/account-deletion/account-deletion.service";
import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  AuthRequestServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AccountSwitcherService } from "@bitwarden/common/auth/account-switcher";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { LockService } from "@bitwarden/unlock";

import { AppComponent } from "./app.component";
import { ImportDesktopComponent } from "./tools/import/import-desktop.component";

describe("AppComponent (desktop)", () => {
  let component: AppComponent;

  let broadcasterService: MockProxy<BroadcasterService>;
  let syncService: MockProxy<SyncService>;
  let accountService: MockProxy<AccountService>;
  let premiumCheckoutPendingService: MockProxy<PremiumCheckoutPendingService>;
  let ngZone: MockProxy<NgZone>;
  let authRequestAnsweringService: MockProxy<AuthRequestAnsweringService>;
  let logService: MockProxy<LogService>;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;
  let router: MockProxy<Router>;
  let authService: MockProxy<AuthService>;
  let messagingService: MockProxy<MessagingService>;
  let modalService: MockProxy<ModalService>;
  let keyService: MockProxy<KeyService>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let accountSwitcherService: MockProxy<AccountSwitcherService>;

  let broadcasterCallback: (message: any) => Promise<void>;
  let lastZoneRunResult: unknown;

  const userId = "user-1" as UserId;

  beforeEach(() => {
    broadcasterService = mock<BroadcasterService>();
    syncService = mock<SyncService>();
    accountService = mock<AccountService>();
    premiumCheckoutPendingService = mock<PremiumCheckoutPendingService>();
    ngZone = mock<NgZone>();
    authRequestAnsweringService = mock<AuthRequestAnsweringService>();
    logService = mock<LogService>();
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));
    dialogService = mock<DialogService>();
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    authService = mock<AuthService>();
    messagingService = mock<MessagingService>();
    modalService = mock<ModalService>();
    keyService = mock<KeyService>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    accountSwitcherService = mock<AccountSwitcherService>();
    accountSwitcherService.resolveActiveAccount.mockResolvedValue({ action: "keep" });

    accountService.activeAccount$ = of({ id: userId } as any);
    (accountService as any).showHeader$ = EMPTY;
    ngZone.run.mockImplementation((fn: () => unknown) => (lastZoneRunResult = fn()) as any);
    ngZone.runOutsideAngular.mockImplementation((fn: () => unknown) => fn() as any);

    broadcasterService.subscribe.mockImplementation((_id: string, cb: (message: any) => void) => {
      broadcasterCallback = cb as (message: any) => Promise<void>;
    });

    const deviceTrustToastService = mock<DeviceTrustToastService>();
    deviceTrustToastService.setupListeners$ = EMPTY;
    const documentLangSetter = mock<DocumentLangSetter>();
    documentLangSetter.start.mockReturnValue({ unsubscribe: jest.fn() } as any);

    // The constructor calls `takeUntilDestroyed()`, which requires an injection context.
    component = TestBed.runInInjectionContext(
      () =>
        new AppComponent(
          broadcasterService,
          mock<InternalFolderService>(),
          syncService,
          mock<CipherService>(),
          authService,
          router,
          mock<ToastService>(),
          mock<I18nService>(),
          ngZone,
          mock<VaultTimeoutSettingsService>(),
          keyService,
          mock<LegacyCompatKeyService>(),
          logService,
          messagingService,
          mock<ServerNotificationsService>(),
          mock<PlatformUtilsService>(),
          mock<SystemService>(),
          mock<ProcessReloadServiceAbstraction>(),
          mock<StateService>(),
          mock<EventUploadService>(),
          modalService,
          mock<UserVerificationService>(),
          configService,
          dialogService,
          mock<BiometricStateService>(),
          mock<StateEventRunnerService>(),
          accountService,
          deviceTrustToastService,
          userDecryptionOptionsService,
          mock<DestroyRef>(),
          documentLangSetter,
          mock<RestrictedItemTypesService>(),
          mock<PinServiceAbstraction>(),
          mock<TokenService>(),
          mock<LockService>(),
          mock<PremiumUpgradePromptService>(),
          mock<PendingAuthRequestsStateService>(),
          mock<AuthRequestServiceAbstraction>(),
          authRequestAnsweringService,
          mock<SsoLoginServiceAbstraction>(),
          mock<AccountDeletionService>(),
          premiumCheckoutPendingService,
          mock<BillingAccountProfileStateService>(),
          accountSwitcherService,
        ),
    );

    component.ngOnInit();
  });

  const dispatchMessage = async (message: any) => {
    await broadcasterCallback(message);
    // The message handler runs inside an un-awaited `ngZone.run`, so wait for it to finish.
    await lastZoneRunResult;
  };

  it("syncs once on window focus when a premium checkout was pending", async () => {
    premiumCheckoutPendingService.consumeCheckoutPending.mockResolvedValue(true);

    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: true });

    expect(premiumCheckoutPendingService.consumeCheckoutPending).toHaveBeenCalledWith(userId);
    expect(syncService.fullSync).toHaveBeenCalledWith(true);
  });

  it("does not sync on window focus when nothing was pending", async () => {
    premiumCheckoutPendingService.consumeCheckoutPending.mockResolvedValue(false);

    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: true });

    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("does not consume or sync when the window lost focus (windowIsFocused: false)", async () => {
    premiumCheckoutPendingService.consumeCheckoutPending.mockResolvedValue(true);

    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: false });

    expect(premiumCheckoutPendingService.consumeCheckoutPending).not.toHaveBeenCalled();
    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("fails closed: window focus handling resolves and logs when consume throws", async () => {
    const error = new Error("boom");
    premiumCheckoutPendingService.consumeCheckoutPending.mockRejectedValue(error);

    await expect(
      dispatchMessage({ command: "windowIsFocused", windowIsFocused: true }),
    ).resolves.toBeUndefined();

    expect(syncService.fullSync).not.toHaveBeenCalled();
    expect(logService.error).toHaveBeenCalledWith(
      "Failed to sync after returning from premium checkout",
      error,
    );
  });

  it("does not consume or sync on window focus when there is no active user", async () => {
    accountService.activeAccount$ = of(null);

    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: true });

    expect(premiumCheckoutPendingService.consumeCheckoutPending).not.toHaveBeenCalled();
    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("syncs only once across repeated window focus events", async () => {
    premiumCheckoutPendingService.consumeCheckoutPending.mockResolvedValueOnce(true);
    premiumCheckoutPendingService.consumeCheckoutPending.mockResolvedValue(false);

    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: true });
    await dispatchMessage({ command: "windowIsFocused", windowIsFocused: true });

    expect(syncService.fullSync).toHaveBeenCalledTimes(1);
  });

  describe("importVault message", () => {
    it("opens the legacy import dialog when the import upgrade flag is off", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      await dispatchMessage({ command: "importVault" });

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.ImportUpgrade);
      expect(dialogService.open).toHaveBeenCalledWith(ImportDesktopComponent);
      expect(router.navigate).not.toHaveBeenCalledWith(["/import"]);
    });

    it("navigates to the new import source picker page when the import upgrade flag is on", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);

      await dispatchMessage({ command: "importVault" });

      expect(router.navigate).toHaveBeenCalledWith(["/import"]);
      expect(dialogService.open).not.toHaveBeenCalledWith(ImportDesktopComponent);
    });
  });

  describe("switchAccount message", () => {
    const targetUserId = "user-2" as UserId;

    it("navigates to login without syncing when the target account is logged out", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

      await dispatchMessage({ command: "switchAccount", userId: targetUserId });

      expect(accountService.switchAccount).toHaveBeenCalledWith(targetUserId);
      expect(modalService.closeAll).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["login"]);
      expect(router.navigate).not.toHaveBeenCalledWith(["vault"], expect.anything());
      expect(syncService.fullSync).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalledWith("unlocked");
      expect(messagingService.send).toHaveBeenCalledWith("finishSwitchAccount");
    });

    it("keeps the router outlet mounted when the target account is logged out", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);
      let loadingDuringNavigation: boolean | undefined;
      router.navigate.mockImplementation(async () => {
        loadingDuringNavigation = component.loading;
        return true;
      });

      await dispatchMessage({ command: "switchAccount", userId: targetUserId });

      expect(loadingDuringNavigation).toBe(false);
      expect(component.loading).toBe(false);
    });

    it("navigates to lock when the target account is locked", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(of({} as any));
      keyService.everHadUserKey$.mockReturnValue(of(true));

      await dispatchMessage({ command: "switchAccount", userId: targetUserId });

      expect(router.navigate).toHaveBeenCalledWith(["lock"]);
      expect(syncService.fullSync).not.toHaveBeenCalled();
      expect(messagingService.send).toHaveBeenCalledWith("finishSwitchAccount");
    });

    it("navigates to login-initiated when a locked TDE account never had a user key", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({ trustedDeviceOption: {} } as any),
      );
      keyService.everHadUserKey$.mockReturnValue(of(false));

      await dispatchMessage({ command: "switchAccount", userId: targetUserId });

      expect(router.navigate).toHaveBeenCalledWith(["login-initiated"]);
      expect(router.navigate).not.toHaveBeenCalledWith(["lock"]);
      expect(messagingService.send).toHaveBeenCalledWith("finishSwitchAccount");
    });

    it("syncs and navigates to the vault when the target account is unlocked", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

      await dispatchMessage({ command: "switchAccount", userId: targetUserId });

      expect(messagingService.send).toHaveBeenCalledWith("unlocked");
      expect(syncService.fullSync).toHaveBeenCalledWith(false);
      expect(router.navigate).toHaveBeenCalledWith(["vault"], { onSameUrlNavigation: "reload" });
      expect(messagingService.send).toHaveBeenCalledWith("finishSwitchAccount");
    });
  });

  describe("active account resolution on load", () => {
    const resolveOnLoad = async () => {
      component.ngOnInit();
      await new Promise((resolve) => setTimeout(resolve));
    };

    it("asks the switcher service once when initialized", () => {
      expect(accountSwitcherService.resolveActiveAccount).toHaveBeenCalledTimes(1);
    });

    it("clears the active account and navigates to login when no account can replace it", async () => {
      accountSwitcherService.resolveActiveAccount.mockResolvedValue({ action: "clear" });

      await resolveOnLoad();

      expect(accountService.switchAccount).toHaveBeenCalledWith(null);
      expect(router.navigate).toHaveBeenCalledWith(["login"]);
      expect(messagingService.send).not.toHaveBeenCalledWith("switchAccount", expect.anything());
    });

    it("does nothing when the active account can stay active", async () => {
      await resolveOnLoad();

      expect(messagingService.send).not.toHaveBeenCalledWith("switchAccount", expect.anything());
      expect(accountService.switchAccount).not.toHaveBeenCalled();
    });

    describe("when sent messages reach the message handler", () => {
      const nextUserId = "user-2" as UserId;

      /** Initializes the component and resolves once the resulting account switch finishes. */
      const resolveOnLoadThroughHandler = () => {
        const switchFinished = new Promise<void>((resolve) => {
          messagingService.send.mockImplementation((command: string, arg: object = {}) => {
            if (command === "finishSwitchAccount") {
              resolve();
            }
            void broadcasterCallback({ command, ...arg });
          });
        });
        component.ngOnInit();
        return switchFinished;
      };

      it("lands on login without re-creating the router outlet when the resolved account is logged out", async () => {
        accountSwitcherService.resolveActiveAccount.mockResolvedValue({
          action: "switch",
          userId: nextUserId,
        });
        authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);
        const loadingDuringNavigation: boolean[] = [];
        router.navigate.mockImplementation(async () => {
          loadingDuringNavigation.push(component.loading);
          return true;
        });

        await resolveOnLoadThroughHandler();

        expect(accountService.switchAccount).toHaveBeenCalledWith(nextUserId);
        expect(router.navigate).toHaveBeenCalledWith(["login"]);
        expect(loadingDuringNavigation).toEqual([false]);
        expect(syncService.fullSync).not.toHaveBeenCalled();
      });
    });

    it("logs and does not throw when resolution fails", async () => {
      const error = new Error("boom");
      accountSwitcherService.resolveActiveAccount.mockRejectedValue(error);

      await resolveOnLoad();

      expect(logService.error).toHaveBeenCalledWith(
        "Failed to resolve the active account on load",
        error,
      );
    });
  });

  describe("logout message", () => {
    it("switches to the next switchable account when the active account logs out", async () => {
      const nextUserId = "user-2" as UserId;
      accountSwitcherService.nextSwitchableAccount$ = of({ id: nextUserId } as any);
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));

      await dispatchMessage({ command: "logout", userId });

      expect(messagingService.send).toHaveBeenCalledWith("switchAccount", { userId: nextUserId });
      expect(accountService.switchAccount).not.toHaveBeenCalledWith(null);
      expect(router.navigate).not.toHaveBeenCalledWith(["login"]);
    });

    it("does not switch accounts when a background account logs out", async () => {
      const backgroundUserId = "user-3" as UserId;
      accountSwitcherService.nextSwitchableAccount$ = of({ id: "user-2" } as any);
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));

      await dispatchMessage({ command: "logout", userId: backgroundUserId });

      expect(messagingService.send).not.toHaveBeenCalledWith("switchAccount", expect.anything());
      expect(accountService.switchAccount).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalledWith(["login"]);
    });

    it("clears the active account and navigates to login when no account is switchable", async () => {
      accountSwitcherService.nextSwitchableAccount$ = of(null);
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));

      await dispatchMessage({ command: "logout", userId });

      expect(accountService.switchAccount).toHaveBeenCalledWith(null);
      expect(router.navigate).toHaveBeenCalledWith(["login"]);
    });
  });
});
