import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { LockService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
  VaultTimeoutAction,
} from "@bitwarden/common/key-management/vault-timeout";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";

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

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const biometricStateService = mock<BiometricStateService>();
  const policyService = mock<PolicyService>();
  const pinServiceAbstraction = mock<PinServiceAbstraction>();
  const keyService = mock<KeyService>();
  const validationService = mock<ValidationService>();
  const dialogService = mock<DialogService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const lockService = mock<LockService>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AccountSecurityComponent, useValue: mock<AccountSecurityComponent>() },
        { provide: ActivatedRoute, useValue: mock<ActivatedRoute>() },
        { provide: BiometricsService, useValue: mock<BiometricsService>() },
        { provide: BiometricStateService, useValue: biometricStateService },
        { provide: DialogService, useValue: dialogService },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: MessageSender, useValue: mock<MessageSender>() },
        { provide: KeyService, useValue: keyService },
        { provide: PinServiceAbstraction, useValue: pinServiceAbstraction },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: PolicyService, useValue: policyService },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: ValidationService, useValue: validationService },
        { provide: LockService, useValue: lockService },
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

    fixture = TestBed.createComponent(AccountSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    biometricStateService.promptAutomatically$ = of(false);
    pinServiceAbstraction.isPinSet.mockResolvedValue(false);
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
});
