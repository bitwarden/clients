import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
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
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

import { NativeMessagingPermissionDialogComponent } from "../../../key-management/shared-unlock/popup/native-messaging-permission-dialog.component";
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
  const mockI18nService = mock<I18nService>();

  // Mock subjects to control the phishing detection observables
  let phishingAvailableSubject: BehaviorSubject<boolean>;
  let phishingEnabledSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AccountSecurityComponent, useValue: mock<AccountSecurityComponent>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (): null => null } },
          } as unknown as ActivatedRoute,
        },
        { provide: ApiService, useValue: apiService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingService,
        },
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
    let openDialogSpy: jest.SpyInstance;
    let popoutSpy: jest.SpyInstance;
    let closePopoutSpy: jest.SpyInstance;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      permissionsGrantedSpy = jest.spyOn(BrowserApi, "permissionsGranted");
      openDialogSpy = jest.spyOn(NativeMessagingPermissionDialogComponent, "open");
      popoutSpy = jest
        .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
        .mockResolvedValue(undefined);
      closePopoutSpy = jest
        .spyOn(BrowserPopupUtils, "closeCurrentPopupOrPopout")
        .mockResolvedValue(undefined);
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
      it("persists the setting without prompting when the permission is already granted", async () => {
        permissionsGrantedSpy.mockResolvedValue(true);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(openDialogSpy).not.toHaveBeenCalled();
        expect(popoutSpy).not.toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          true,
          mockUserId,
        );
        expect(component.messagingService.send).not.toHaveBeenCalledWith("reloadExtension");
      });

      it("pops out to request the permission when not granted and not in a popout", async () => {
        permissionsGrantedSpy.mockResolvedValue(false);
        jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(popoutSpy).toHaveBeenCalled();
        expect(openDialogSpy).not.toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalledWith(
          true,
          mockUserId,
        );
      });

      it("persists and reloads when the permission dialog grants the permission in a popout", async () => {
        permissionsGrantedSpy.mockResolvedValue(false);
        jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
        openDialogSpy.mockReturnValue({ closed: of(true) } as unknown as DialogRef<boolean>);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(openDialogSpy).toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          true,
          mockUserId,
        );
        expect(component.messagingService.send).toHaveBeenCalledWith("reloadExtension");
        expect(closePopoutSpy).toHaveBeenCalled();
      });

      it("reverts the toggle when the permission dialog does not grant the permission", async () => {
        permissionsGrantedSpy.mockResolvedValue(false);
        jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
        openDialogSpy.mockReturnValue({ closed: of(false) } as unknown as DialogRef<boolean>);

        await component.ngOnInit();
        await component.updateBiometric(true);

        expect(component.form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalledWith(
          true,
          mockUserId,
        );
      });
    });
  });

  describe("updateAllowSharingUnlockStateWithDesktop", () => {
    let permissionsGrantedSpy: jest.SpyInstance;
    let openDialogSpy: jest.SpyInstance;
    let popoutSpy: jest.SpyInstance;
    let closePopoutSpy: jest.SpyInstance;

    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([null]));
      permissionsGrantedSpy = jest.spyOn(BrowserApi, "permissionsGranted");
      openDialogSpy = jest.spyOn(NativeMessagingPermissionDialogComponent, "open");
      popoutSpy = jest
        .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
        .mockResolvedValue(undefined);
      closePopoutSpy = jest
        .spyOn(BrowserPopupUtils, "closeCurrentPopupOrPopout")
        .mockResolvedValue(undefined);
    });

    it("persists the setting without prompting when the permission is already granted", async () => {
      permissionsGrantedSpy.mockResolvedValue(true);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(openDialogSpy).not.toHaveBeenCalled();
      expect(popoutSpy).not.toHaveBeenCalled();
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).toHaveBeenCalledWith(true, mockUserId);
    });

    it("persists the setting when disabled", async () => {
      permissionsGrantedSpy.mockResolvedValue(true);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(false);

      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).toHaveBeenCalledWith(false, mockUserId);
    });

    it("pops out to request the permission when not granted and not in a popout", async () => {
      permissionsGrantedSpy.mockResolvedValue(false);
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(popoutSpy).toHaveBeenCalled();
      expect(openDialogSpy).not.toHaveBeenCalled();
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
    });

    it("persists and reloads when the permission dialog grants the permission in a popout", async () => {
      permissionsGrantedSpy.mockResolvedValue(false);
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      openDialogSpy.mockReturnValue({ closed: of(true) } as unknown as DialogRef<boolean>);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(openDialogSpy).toHaveBeenCalled();
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).toHaveBeenCalledWith(true, mockUserId);
      expect(component.messagingService.send).toHaveBeenCalledWith("reloadExtension");
      expect(closePopoutSpy).toHaveBeenCalled();
    });

    it("reverts the toggle when the permission dialog does not grant the permission", async () => {
      permissionsGrantedSpy.mockResolvedValue(false);
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      openDialogSpy.mockReturnValue({ closed: of(false) } as unknown as DialogRef<boolean>);

      await component.ngOnInit();
      await component.updateAllowSharingUnlockStateWithDesktop(true);

      expect(component.form.controls.allowSharingUnlockStateWithDesktop.value).toBe(false);
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
    });
  });
});
