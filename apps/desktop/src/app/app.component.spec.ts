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
  LockService,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
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

import { AppComponent } from "./app.component";

describe("AppComponent (desktop)", () => {
  let component: AppComponent;

  let broadcasterService: MockProxy<BroadcasterService>;
  let syncService: MockProxy<SyncService>;
  let accountService: MockProxy<AccountService>;
  let premiumCheckoutPendingService: MockProxy<PremiumCheckoutPendingService>;
  let ngZone: MockProxy<NgZone>;
  let authRequestAnsweringService: MockProxy<AuthRequestAnsweringService>;
  let logService: MockProxy<LogService>;

  let broadcasterCallback: (message: any) => Promise<void>;

  const userId = "user-1" as UserId;

  beforeEach(() => {
    broadcasterService = mock<BroadcasterService>();
    syncService = mock<SyncService>();
    accountService = mock<AccountService>();
    premiumCheckoutPendingService = mock<PremiumCheckoutPendingService>();
    ngZone = mock<NgZone>();
    authRequestAnsweringService = mock<AuthRequestAnsweringService>();
    logService = mock<LogService>();

    accountService.activeAccount$ = of({ id: userId } as any);
    (accountService as any).showHeader$ = EMPTY;
    ngZone.run.mockImplementation((fn: () => unknown) => fn() as any);
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
          mock<AuthService>(),
          mock<Router>(),
          mock<ToastService>(),
          mock<I18nService>(),
          ngZone,
          mock<VaultTimeoutSettingsService>(),
          mock<KeyService>(),
          logService,
          mock<MessagingService>(),
          mock<ServerNotificationsService>(),
          mock<PlatformUtilsService>(),
          mock<SystemService>(),
          mock<ProcessReloadServiceAbstraction>(),
          mock<StateService>(),
          mock<EventUploadService>(),
          mock<ModalService>(),
          mock<UserVerificationService>(),
          mock<ConfigService>(),
          mock<DialogService>(),
          mock<BiometricStateService>(),
          mock<StateEventRunnerService>(),
          accountService,
          deviceTrustToastService,
          mock<UserDecryptionOptionsServiceAbstraction>(),
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
        ),
    );

    component.ngOnInit();
  });

  const dispatchMessage = async (message: any) => {
    await broadcasterCallback(message);
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
});
