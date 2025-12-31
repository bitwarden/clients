import { Component } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of, BehaviorSubject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { NudgesService } from "@bitwarden/angular/vault";
import { LockService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
  VaultTimeoutAction,
} from "@bitwarden/common/key-management/vault-timeout";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import {
  BiometricStateService,
  BiometricsService,
  BiometricsStatus,
  KeyService,
} from "@bitwarden/key-management";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { AccountSecurityComponent } from "./account-security.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-pop-out",
  template: ` <ng-content></ng-content>`,
})
class MockPopOutComponent {}

describe("AccountSecurityComponent", () => {
  let component: AccountSecurityComponent;
  let fixture: ComponentFixture<AccountSecurityComponent>;

  const mockUserId = newGuid() as UserId;

  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const apiService = mock<ApiService>();
  const billingService = mock<BillingAccountProfileStateService>();
  const biometricStateService = mock<BiometricStateService>();
  const biometricsService = mock<BiometricsService>();
  const configService = mock<ConfigService>();
  const dialogService = mock<DialogService>();
  const keyService = mock<KeyService>();
  const lockService = mock<LockService>();
  const policyService = mock<PolicyService>();
  const phishingDetectionSettingsService = mock<PhishingDetectionSettingsServiceAbstraction>();
  const pinServiceAbstraction = mock<PinServiceAbstraction>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const validationService = mock<ValidationService>();
  const vaultNudgesService = mock<NudgesService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const mockI18nService = mock<I18nService>();

  // Mock subjects to control the phishing detection observables
  let phishingAvailableSubject: BehaviorSubject<boolean>;
  let phishingEnabledSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AccountSecurityComponent, useValue: mock<AccountSecurityComponent>() },
        { provide: ActivatedRoute, useValue: mock<ActivatedRoute>() },
        { provide: ApiService, useValue: apiService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingService,
        },
        { provide: BiometricsService, useValue: biometricsService },
        { provide: BiometricStateService, useValue: biometricStateService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: dialogService },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: I18nService, useValue: mockI18nService },
        { provide: KeyService, useValue: keyService },
        { provide: LockService, useValue: lockService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: MessageSender, useValue: mock<MessageSender>() },
        { provide: NudgesService, useValue: vaultNudgesService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: PinServiceAbstraction, useValue: pinServiceAbstraction },
        {
          provide: PhishingDetectionSettingsServiceAbstraction,
          useValue: phishingDetectionSettingsService,
        },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: PolicyService, useValue: policyService },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
        { provide: ValidationService, useValue: validationService },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
      ],
    })
      .overrideComponent(AccountSecurityComponent, {
        remove: {
          imports: [PopOutComponent],
          providers: [DialogService],
        },
        add: {
          imports: [MockPopOutComponent],
          providers: [{ provide: DialogService, useValue: dialogService }],
        },
      })
      .compileComponents();

    apiService.getProfile.mockResolvedValue(
      mock<ProfileResponse>({
        id: mockUserId,
        creationDate: new Date().toISOString(),
      }),
    );
    vaultNudgesService.showNudgeSpotlight$.mockReturnValue(of(false));
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    vaultTimeoutSettingsService.availableVaultTimeoutActions$.mockReturnValue(of([]));
    biometricStateService.promptAutomatically$ = of(false);
    pinServiceAbstraction.isPinSet.mockResolvedValue(false);
    configService.getFeatureFlag$.mockReturnValue(of(false));
    billingService.hasPremiumPersonally$.mockReturnValue(of(true));
    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    policyService.policiesByType$.mockReturnValue(of([null]));

    // Mock readonly observables for phishing detection using BehaviorSubjects so
    // tests can push different values after component creation.
    phishingAvailableSubject = new BehaviorSubject<boolean>(true);
    phishingEnabledSubject = new BehaviorSubject<boolean>(true);

    (phishingDetectionSettingsService.available$ as any) = phishingAvailableSubject.asObservable();
    (phishingDetectionSettingsService.enabled$ as any) = phishingEnabledSubject.asObservable();

    fixture = TestBed.createComponent(AccountSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("pin enabled when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(true);
  });

  it("pin enabled when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(true);

    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin disabled when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(false);

    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).toBeNull();
  });

  it("pin visible when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin visible when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin visible when RemoveUnlockWithPin policy is enabled and pin set", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    pinServiceAbstraction.isPinSet.mockResolvedValue(true);

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin not visible when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).toBeNull();
  });

  describe("phishing detection UI and setting", () => {
    it("updates phishing detection setting when form value changes", async () => {
      policyService.policiesByType$.mockReturnValue(of([null]));

      phishingAvailableSubject.next(true);
      phishingEnabledSubject.next(true);

      // Init component
      await component.ngOnInit();
      fixture.detectChanges();

      // Initial form value should match enabled$ observable defaulting to true
      expect(component.form.controls.enablePhishingDetection.value).toBe(true);

      // Change the form value to false
      component.form.controls.enablePhishingDetection.setValue(false);
      fixture.detectChanges();
      // Wait briefly to allow any debounced or async valueChanges handlers to run
      // fixture.whenStable() does not work here
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(phishingDetectionSettingsService.setEnabled).toHaveBeenCalledWith(mockUserId, false);
    });

    it("shows phishing detection element when available$ is true", async () => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      phishingAvailableSubject.next(true);
      phishingEnabledSubject.next(true);

      await component.ngOnInit();
      fixture.detectChanges();

      const phishingDetectionElement = fixture.debugElement.query(
        By.css("#phishingDetectionAction"),
      );
      expect(phishingDetectionElement).not.toBeNull();
    });

    it("hides phishing detection element when available$ is false", async () => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      phishingAvailableSubject.next(false);
      phishingEnabledSubject.next(true);

      await component.ngOnInit();
      fixture.detectChanges();

      const phishingDetectionElement = fixture.debugElement.query(
        By.css("#phishingDetectionAction"),
      );
      expect(phishingDetectionElement).toBeNull();
    });
  });

  describe("updateBiometric", () => {
    let browserApiSpy: jest.SpyInstance;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      browserApiSpy = jest.spyOn(BrowserApi, "requestPermission");
      browserApiSpy.mockResolvedValue(true);
    });

    describe("updating to false", () => {
      it("calls biometricStateService methods with false when false", async () => {
        await component.ngOnInit();
        await component.updateBiometric(false);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(false);
        expect(biometricStateService.setFingerprintValidated).toHaveBeenCalledWith(false);
      });
    });

    describe("updating to true", () => {
      let trySetupBiometricsSpy: jest.SpyInstance;

      beforeEach(() => {
        trySetupBiometricsSpy = jest.spyOn(component, "trySetupBiometrics");
      });

      it("displays permission error dialog when nativeMessaging permission is not granted", async () => {
        browserApiSpy.mockResolvedValue(false);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: { key: "nativeMessaginPermissionErrorTitle" },
          content: { key: "nativeMessaginPermissionErrorDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });
        expect(component.form.controls.biometric.value).toBe(false);
        expect(trySetupBiometricsSpy).not.toHaveBeenCalled();
      });

      it("displays a specific sidebar dialog when nativeMessaging permissions throws an error on firefox + sidebar", async () => {
        browserApiSpy.mockRejectedValue(new Error("Permission denied"));
        platformUtilsService.isFirefox.mockReturnValue(true);
        jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(true);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: { key: "nativeMessaginPermissionSidebarTitle" },
          content: { key: "nativeMessaginPermissionSidebarDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
        expect(component.form.controls.biometric.value).toBe(false);
        expect(trySetupBiometricsSpy).not.toHaveBeenCalled();
      });

      test.each([
        [false, false],
        [false, true],
        [true, false],
      ])(
        "displays a generic dialog when nativeMessaging permissions throws an error and isFirefox is %s and onSidebar is %s",
        async (isFirefox, inSidebar) => {
          browserApiSpy.mockRejectedValue(new Error("Permission denied"));
          platformUtilsService.isFirefox.mockReturnValue(isFirefox);
          jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(inSidebar);

          await component.ngOnInit();
          await component.updateBiometric(true);

          expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
            title: { key: "nativeMessaginPermissionErrorTitle" },
            content: { key: "nativeMessaginPermissionErrorDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "danger",
          });
          expect(component.form.controls.biometric.value).toBe(false);
          expect(trySetupBiometricsSpy).not.toHaveBeenCalled();
        },
      );

      it("refreshes additional keys and attempts to setup biometrics when enabled with nativeMessaging permission", async () => {
        const setupBiometricsResult = true;
        trySetupBiometricsSpy.mockResolvedValue(setupBiometricsResult);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          setupBiometricsResult,
        );
        expect(component.form.controls.biometric.value).toBe(setupBiometricsResult);
      });

      it("handles failed biometrics setup", async () => {
        const setupBiometricsResult = false;
        trySetupBiometricsSpy.mockResolvedValue(setupBiometricsResult);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          setupBiometricsResult,
        );
        expect(biometricStateService.setFingerprintValidated).toHaveBeenCalledWith(
          setupBiometricsResult,
        );
        expect(component.form.controls.biometric.value).toBe(setupBiometricsResult);
      });

      it("handles error during biometrics setup", async () => {
        // Simulate an error during biometrics setup
        keyService.refreshAdditionalKeys.mockRejectedValue(new Error("UserId is required"));

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(validationService.showError).toHaveBeenCalledWith(new Error("UserId is required"));
        expect(component.form.controls.biometric.value).toBe(false);
        expect(trySetupBiometricsSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe("biometrics polling timer", () => {
    let browserApiSpy: jest.SpyInstance;

    beforeEach(() => {
      browserApiSpy = jest.spyOn(BrowserApi, "permissionsGranted");
    });

    afterEach(() => {
      component.ngOnDestroy();
    });

    it("disables biometric control when canEnableBiometricUnlock is false", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(false);

      await component.ngOnInit();
      tick();

      expect(component.form.controls.biometric.disabled).toBe(true);
    }));

    it("enables biometric control when canEnableBiometricUnlock is true", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(true);

      await component.ngOnInit();
      tick();

      expect(component.form.controls.biometric.disabled).toBe(false);
    }));

    it("skips status check when nativeMessaging permission is not granted and not Safari", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(true);
      browserApiSpy.mockResolvedValue(false);
      platformUtilsService.isSafari.mockReturnValue(false);

      await component.ngOnInit();
      tick();

      expect(biometricsService.getBiometricsStatusForUser).not.toHaveBeenCalled();
      expect(component.biometricUnavailabilityReason).toBeUndefined();
    }));

    it("checks biometrics status when nativeMessaging permission is granted", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(true);
      browserApiSpy.mockResolvedValue(true);
      platformUtilsService.isSafari.mockReturnValue(false);
      biometricsService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.DesktopDisconnected,
      );

      await component.ngOnInit();
      tick();

      expect(biometricsService.getBiometricsStatusForUser).toHaveBeenCalledWith(mockUserId);
    }));

    it("should check status on Safari", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(true);
      browserApiSpy.mockResolvedValue(false);
      platformUtilsService.isSafari.mockReturnValue(true);
      biometricsService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.DesktopDisconnected,
      );

      await component.ngOnInit();
      tick();

      expect(biometricsService.getBiometricsStatusForUser).toHaveBeenCalledWith(mockUserId);
    }));

    test.each([
      [
        BiometricsStatus.DesktopDisconnected,
        "biometricsStatusHelptextDesktopDisconnected-used-i18n",
      ],
      [
        BiometricsStatus.NotEnabledInConnectedDesktopApp,
        "biometricsStatusHelptextNotEnabledInDesktop-used-i18n",
      ],
      [
        BiometricsStatus.HardwareUnavailable,
        "biometricsStatusHelptextHardwareUnavailable-used-i18n",
      ],
    ])(
      "sets expected unavailability reason for %s status when biometric not available",
      fakeAsync(async (biometricStatus: BiometricsStatus, expected: string) => {
        biometricsService.canEnableBiometricUnlock.mockResolvedValue(false);
        browserApiSpy.mockResolvedValue(true);
        platformUtilsService.isSafari.mockReturnValue(false);
        biometricsService.getBiometricsStatusForUser.mockResolvedValue(biometricStatus);

        await component.ngOnInit();
        tick();

        expect(component.biometricUnavailabilityReason).toBe(expected);
      }),
    );

    it("should not set unavailability reason for error statuses when biometric is available", fakeAsync(async () => {
      biometricsService.canEnableBiometricUnlock.mockResolvedValue(true);
      browserApiSpy.mockResolvedValue(true);
      platformUtilsService.isSafari.mockReturnValue(false);
      biometricsService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.DesktopDisconnected,
      );

      await component.ngOnInit();
      tick();

      // Status is DesktopDisconnected but biometric IS available, so don't show error
      expect(component.biometricUnavailabilityReason).toBe("");
      component.ngOnDestroy();
    }));
  });
});
