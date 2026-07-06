import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of, BehaviorSubject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { NudgesService } from "@bitwarden/angular/vault";
import { LockService } from "@bitwarden/auth/common";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
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
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

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

@Component({
  selector: "bit-session-timeout-settings",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSessionTimeoutSettingsComponent {
  readonly refreshTimeoutActionSettings = input<any>();
}

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
  const vaultNudgesService = mock<NudgesService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const sharedUnlockSettingsService = mock<SharedUnlockSettingsService>();
  const messagingService = mock<MessageSender>();
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
        { provide: MessageSender, useValue: messagingService },
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
        { provide: LockService, useValue: lockService },
        {
          provide: AutomaticUserConfirmationService,
          useValue: mock<AutomaticUserConfirmationService>(),
        },
        { provide: ConfigService, useValue: configService },
        { provide: SharedUnlockSettingsService, useValue: sharedUnlockSettingsService },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
      ],
    })
      .overrideComponent(AccountSecurityComponent, {
        remove: {
          imports: [PopOutComponent, SessionTimeoutSettingsComponent],
          providers: [DialogService],
        },
        add: {
          imports: [MockPopOutComponent, MockSessionTimeoutSettingsComponent],
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
    biometricStateService.promptAutomatically$.mockReturnValue(of(false));
    pinServiceAbstraction.isPinSet.mockResolvedValue(false);
    configService.getFeatureFlag$.mockReturnValue(of(false));
    billingService.hasPremiumPersonally$.mockReturnValue(of(true));
    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.isFirefox.mockReturnValue(false);
    sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$.mockReturnValue(of(false));
    sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$.mockReturnValue(of(false));
    sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop.mockResolvedValue(undefined);
    sharedUnlockSettingsService.setAllowSharingUnlockStateWithWeb.mockResolvedValue(undefined);

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
    let permissionsGrantedSpy: jest.SpyInstance;
    let requestPermissionSpy: jest.SpyInstance;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      permissionsGrantedSpy = jest.spyOn(BrowserApi, "permissionsGranted");
      permissionsGrantedSpy.mockResolvedValue(true);
      requestPermissionSpy = jest.spyOn(BrowserApi, "requestPermission");
      requestPermissionSpy.mockResolvedValue(true);
    });

    describe("updating to false", () => {
      it("calls biometricStateService methods with false when false", async () => {
        await component.ngOnInit();
        await component.updateBiometric(false);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          false,
          mockUserId,
        );
        expect(biometricStateService.setFingerprintValidated).toHaveBeenCalledWith(false);
      });
    });

    describe("updating to true", () => {
      beforeEach(() => {
        // Default to popout context so the permission dialog shows rather than triggering
        // the popup-to-popout redirect.
        jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);
        // Default: user proceeds through the informational dialog.
        dialogService.open.mockReturnValue({ closed: of(true) } as any);
      });

      it("enables biometric unlock when nativeMessaging permission is granted", async () => {
        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          true,
          mockUserId,
        );
      });

      it("reverts the biometric toggle without a dialog when nativeMessaging permission is denied", async () => {
        permissionsGrantedSpy.mockResolvedValue(false);
        requestPermissionSpy.mockResolvedValue(false);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(component.form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
      });

      it("displays a specific sidebar dialog when nativeMessaging permissions throws an error on firefox + sidebar", async () => {
        permissionsGrantedSpy.mockResolvedValue(false);
        requestPermissionSpy.mockRejectedValue(new Error("permission request failed"));
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
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
      });

      test.each([
        [false, false],
        [false, true],
        [true, false],
      ])(
        "reverts biometric toggle without a dialog when permission request throws and isFirefox is %s and inSidebar is %s",
        async (isFirefox, inSidebar) => {
          permissionsGrantedSpy.mockResolvedValue(false);
          requestPermissionSpy.mockRejectedValue(new Error("permission request failed"));
          platformUtilsService.isFirefox.mockReturnValue(isFirefox);
          jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(inSidebar);

          await component.ngOnInit();
          await component.updateBiometric(true);

          expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
          expect(component.form.controls.biometric.value).toBe(false);
          expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
        },
      );

      it("pops out without showing the dialog or requesting the permission when in the popup", async () => {
        jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);
        jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
        const openPopoutSpy = jest
          .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
          .mockResolvedValue(undefined as any);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(openPopoutSpy).toHaveBeenCalled();
        expect(dialogService.open).not.toHaveBeenCalled();
        expect(requestPermissionSpy).not.toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
      });

      it("shows the informational dialog before requesting the permission", async () => {
        jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
        requestPermissionSpy.mockResolvedValue(true);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(dialogService.open).toHaveBeenCalled();
      });

      it("saves state then reloads when permission is just granted", async () => {
        jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
        requestPermissionSpy.mockResolvedValue(true);

        await component.ngOnInit();
        await component.updateBiometric(true);

        const setBiometricOrder = biometricStateService.setBiometricUnlockEnabled.mock.invocationCallOrder[0];
        const sendOrder = messagingService.send.mock.invocationCallOrder[0];
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true, mockUserId);
        expect(messagingService.send).toHaveBeenCalledWith("reloadExtension");
        expect(setBiometricOrder).toBeLessThan(sendOrder);
      });

      it("reverts the toggle and does not request the permission when the user closes the dialog", async () => {
        jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
        dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(requestPermissionSpy).not.toHaveBeenCalled();
        expect(component.form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
      });

      it("shows the dialog again on subsequent enable attempts after the user cancels", async () => {
        jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
        dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

        await component.ngOnInit();

        // First attempt: user cancels, toggle reverts to false.
        await component.updateBiometric(true);
        expect(dialogService.open).toHaveBeenCalledTimes(1);
        expect(component.form.controls.biometric.value).toBe(false);

        // Second attempt: dialog must appear again, not be silently skipped.
        dialogService.open.mockClear();
        await component.updateBiometric(true);
        expect(dialogService.open).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("updateAllowSharingUnlockStateWithDesktop", () => {
    let requestPermissionSpy: jest.SpyInstance;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      // Simulate the popout context so the permission is requested directly rather than
      // re-opening the page in a popout.
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);
      jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
      requestPermissionSpy = jest.spyOn(BrowserApi, "requestPermission");
      // The informational dialog is shown every time; default to the user continuing.
      dialogService.open.mockReturnValue({ closed: of(true) } as any);
    });

    it("shows the informational dialog before requesting the permission", async () => {
      requestPermissionSpy.mockResolvedValue(true);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(dialogService.open).toHaveBeenCalled();
    });

    it("pops out without showing the dialog or requesting the permission when in the popup", async () => {
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);
      const openPopoutSpy = jest
        .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
        .mockResolvedValue(undefined as any);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(openPopoutSpy).toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
      expect(requestPermissionSpy).not.toHaveBeenCalled();
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
    });

    it("reverts the toggle and does not request the permission when the user closes the dialog", async () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(requestPermissionSpy).not.toHaveBeenCalled();
      expect(component.form.controls.allowSharingUnlockStateWithDesktop.value).toBe(false);
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
    });

    it("does not show an error dialog and reverts the toggle when the permission is denied", async () => {
      requestPermissionSpy.mockResolvedValue(false);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(component.form.controls.allowSharingUnlockStateWithDesktop.value).toBe(false);
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
    });

    it("persists the setting when the permission is granted", async () => {
      requestPermissionSpy.mockResolvedValue(true);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).toHaveBeenCalledWith(true, mockUserId);
    });

    it("saves state then reloads when permission is just granted", async () => {
      requestPermissionSpy.mockResolvedValue(true);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      const saveOrder =
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop.mock.invocationCallOrder[0];
      const sendOrder = messagingService.send.mock.invocationCallOrder[0];
      expect(sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop).toHaveBeenCalledWith(
        true,
        mockUserId,
      );
      expect(messagingService.send).toHaveBeenCalledWith("reloadExtension");
      expect(saveOrder).toBeLessThan(sendOrder);
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

  describe("desktop sharing permission request on popout", () => {
    let inPopoutSpy: jest.SpyInstance;
    let permissionsGrantedSpy: jest.SpyInstance;
    let updateDesktopSharingSpy: jest.SpyInstance;
    let queryParamGet: jest.Mock;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      inPopoutSpy = jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      permissionsGrantedSpy = jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
      queryParamGet = jest.fn().mockImplementation((key: string) =>
        key === "autoRequestDesktopSharing" ? "true" : null,
      );
      const route = TestBed.inject(ActivatedRoute);
      (route as any).snapshot = { queryParamMap: { get: queryParamGet } };
      updateDesktopSharingSpy = jest
        .spyOn(component, "updateAllowSharingUnlockStateWithDesktop")
        .mockResolvedValue(undefined);
    });

    it("enables the setting to trigger the permission flow", async () => {
      await component.ngOnInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.form.controls.allowSharingUnlockStateWithDesktop.value).toBe(true);
      expect(updateDesktopSharingSpy).toHaveBeenCalledWith(true);
    });

    it("does not trigger the flow when the autoRequestDesktopSharing query param is absent", async () => {
      queryParamGet.mockReturnValue(null);

      await component.ngOnInit();

      expect(updateDesktopSharingSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the flow when not in a popout", async () => {
      inPopoutSpy.mockReturnValue(false);

      await component.ngOnInit();

      expect(updateDesktopSharingSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the flow when the nativeMessaging permission is already granted", async () => {
      permissionsGrantedSpy.mockResolvedValue(true);

      await component.ngOnInit();

      expect(updateDesktopSharingSpy).not.toHaveBeenCalled();
    });
  });

  describe("biometric permission request on popout", () => {
    let inPopoutSpy: jest.SpyInstance;
    let permissionsGrantedSpy: jest.SpyInstance;
    let updateBiometricSpy: jest.SpyInstance;
    let queryParamGet: jest.Mock;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      inPopoutSpy = jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      permissionsGrantedSpy = jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(false);
      queryParamGet = jest.fn().mockImplementation((key: string) =>
        key === "autoRequestBiometrics" ? "true" : null,
      );
      const route = TestBed.inject(ActivatedRoute);
      (route as any).snapshot = { queryParamMap: { get: queryParamGet } };
      updateBiometricSpy = jest
        .spyOn(component, "updateBiometric")
        .mockResolvedValue(undefined);
    });

    it("enables the biometric setting to trigger the permission flow", async () => {
      await component.ngOnInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.form.controls.biometric.value).toBe(true);
      expect(updateBiometricSpy).toHaveBeenCalledWith(true);
    });

    it("does not trigger the flow when the autoRequestBiometrics query param is absent", async () => {
      queryParamGet.mockImplementation(() => null);

      await component.ngOnInit();

      expect(updateBiometricSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the flow when not in a popout", async () => {
      inPopoutSpy.mockReturnValue(false);

      await component.ngOnInit();

      expect(updateBiometricSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the flow when the nativeMessaging permission is already granted", async () => {
      permissionsGrantedSpy.mockResolvedValue(true);

      await component.ngOnInit();

      expect(updateBiometricSpy).not.toHaveBeenCalled();
    });
  });
});
