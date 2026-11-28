import { ChangeDetectorRef, DestroyRef, NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { EMPTY, of } from "rxjs";

import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { PremiumCheckoutReturnService } from "@bitwarden/angular/billing/services/premium-checkout-return.service";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import {
  AuthRequestServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { AnimationControlService } from "@bitwarden/common/platform/abstractions/animation-control.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BiometricsService, BiometricStateService, KeyService } from "@bitwarden/key-management";

import { PopupCompactModeService } from "../platform/popup/layout/popup-compact-mode.service";
import { PopupSizeService } from "../platform/popup/layout/popup-size.service";

import { AppComponent } from "./app.component";

describe("AppComponent (browser popup)", () => {
  let component: AppComponent;

  let accountService: MockProxy<AccountService>;
  let premiumCheckoutReturnService: MockProxy<PremiumCheckoutReturnService>;
  let compactModeService: MockProxy<PopupCompactModeService>;
  let popupSizeService: MockProxy<PopupSizeService>;
  let authService: MockProxy<AuthService>;
  let messageListener: MockProxy<MessageListener>;
  let animationControlService: MockProxy<AnimationControlService>;
  let authRequestAnsweringService: MockProxy<AuthRequestAnsweringService>;
  let router: MockProxy<Router>;
  let ngZone: MockProxy<NgZone>;
  let logService: MockProxy<LogService>;

  const userId = "user-1" as UserId;

  beforeEach(() => {
    accountService = mock<AccountService>();
    premiumCheckoutReturnService = mock<PremiumCheckoutReturnService>();
    premiumCheckoutReturnService.handleReturn.mockResolvedValue();
    logService = mock<LogService>();
    compactModeService = mock<PopupCompactModeService>();
    popupSizeService = mock<PopupSizeService>();
    authService = mock<AuthService>();
    messageListener = mock<MessageListener>();
    animationControlService = mock<AnimationControlService>();
    authRequestAnsweringService = mock<AuthRequestAnsweringService>();
    router = mock<Router>();
    ngZone = mock<NgZone>();

    accountService.activeAccount$ = of({ id: userId } as any);
    authService.activeAccountStatus$ = EMPTY;
    messageListener.allMessages$ = EMPTY;
    animationControlService.enableRoutingAnimation$ = EMPTY;
    (router as any).events = EMPTY;
    popupSizeService.setHeight.mockResolvedValue(undefined);
    ngZone.runOutsideAngular.mockImplementation((fn: () => unknown) => fn());

    const documentLangSetter = mock<DocumentLangSetter>();
    documentLangSetter.start.mockReturnValue({ unsubscribe: jest.fn() } as any);
    const deviceTrustToastService = mock<DeviceTrustToastService>();
    deviceTrustToastService.setupListeners$ = EMPTY;

    const sdkService = mock<SdkService>();
    (sdkService as any).client$ = of(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: PopupCompactModeService, useValue: compactModeService },
        { provide: SdkService, useValue: sdkService },
        { provide: PremiumCheckoutReturnService, useValue: premiumCheckoutReturnService },
      ],
    });

    // The component uses `inject()` for `compactModeService`/`sdkService` field
    // initializers, so it must be constructed inside an injection context.
    component = TestBed.runInInjectionContext(
      () =>
        new AppComponent(
          authService,
          mock<I18nService>(),
          router,
          mock<TokenService>(),
          mock<CipherService>(),
          mock<ChangeDetectorRef>(),
          ngZone,
          mock<PlatformUtilsService>(),
          mock<DialogService>(),
          messageListener,
          mock<ToastService>(),
          accountService,
          animationControlService,
          mock<BiometricStateService>(),
          mock<BiometricsService>(),
          deviceTrustToastService,
          mock<UserDecryptionOptionsServiceAbstraction>(),
          mock<KeyService>(),
          mock<DestroyRef>(),
          documentLangSetter,
          popupSizeService,
          logService,
          mock<AuthRequestServiceAbstraction>(),
          mock<PendingAuthRequestsStateService>(),
          authRequestAnsweringService,
        ),
    );

    // Avoid touching the real chrome.runtime API during ngOnInit.
    (global as any).chrome = {
      runtime: { connect: jest.fn() },
    };
    (window as any).onmousedown = undefined;
  });

  afterEach(() => {
    component.ngOnDestroy();
    jest.clearAllMocks();
  });

  it("hands the active user to the checkout return service on popup open", async () => {
    await component.ngOnInit();

    expect(premiumCheckoutReturnService.handleReturn).toHaveBeenCalledTimes(1);
    expect(premiumCheckoutReturnService.handleReturn).toHaveBeenCalledWith(userId);
  });

  it("does not call the checkout return service when there is no active user", async () => {
    accountService.activeAccount$ = of(null);

    await component.ngOnInit();

    expect(premiumCheckoutReturnService.handleReturn).not.toHaveBeenCalled();
  });

  it("fails closed: ngOnInit resolves and logs when the return handling rejects", async () => {
    const error = new Error("boom");
    premiumCheckoutReturnService.handleReturn.mockRejectedValue(error);

    await expect(component.ngOnInit()).resolves.toBeUndefined();

    expect(logService.error).toHaveBeenCalledWith(
      "Failed to handle the return from premium checkout",
      error,
    );
  });

  describe("window refocus (popout / sidebar)", () => {
    const flushAsync = () => new Promise(process.nextTick);

    it("calls the checkout return service again when the window regains focus", async () => {
      await component.ngOnInit();
      premiumCheckoutReturnService.handleReturn.mockClear();

      window.dispatchEvent(new Event("focus"));
      await flushAsync();

      expect(premiumCheckoutReturnService.handleReturn).toHaveBeenCalledTimes(1);
      expect(premiumCheckoutReturnService.handleReturn).toHaveBeenCalledWith(userId);
    });

    it("stops listening for focus after the component is destroyed", async () => {
      await component.ngOnInit();
      component.ngOnDestroy();
      premiumCheckoutReturnService.handleReturn.mockClear();

      window.dispatchEvent(new Event("focus"));
      await flushAsync();

      expect(premiumCheckoutReturnService.handleReturn).not.toHaveBeenCalled();
    });
  });
});
