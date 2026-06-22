import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

// Passthrough tab components so all tab content renders regardless of active tab
@Component({
  selector: "bit-tab-group",
  standalone: true,
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockTabGroupComponent {}

@Component({
  selector: "bit-tab",
  standalone: true,
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockTabComponent {
  readonly label = input<string>();
}

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { ClearClipboardDelay } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { TabsModule, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@bitwarden/key-management";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { NativeMessagingManifestService } from "../services/native-messaging-manifest.service";

import { SettingsDialogComponent } from "./settings-dialog.component";

@Component({
  selector: "bit-session-timeout-settings",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSessionTimeoutSettingsComponent {
  readonly refreshTimeoutActionSettings = input<any>();
}

describe("SettingsDialogComponent", () => {
  let component: SettingsDialogComponent;
  let fixture: ComponentFixture<SettingsDialogComponent>;
  let originalIpc: any;

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const biometricStateService = mock<BiometricStateService>();
  const policyService = mock<PolicyService>();
  const i18nService = mock<I18nService>();
  const autofillSettingsServiceAbstraction = mock<AutofillSettingsServiceAbstraction>();
  const desktopSettingsService = mock<DesktopSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const desktopAutofillSettingsService = mock<DesktopAutofillSettingsService>();
  const themeStateService = mock<ThemeStateService>();
  const pinServiceAbstraction = mock<PinServiceAbstraction>();
  const desktopBiometricsService = mock<DesktopBiometricsService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const validationService = mock<ValidationService>();
  const messagingService = mock<MessagingService>();
  const keyService = mock<KeyService>();
  const dialogService = mock<DialogService>();
  const desktopAutotypeService = mock<DesktopAutotypeService>();
  const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
  const configService = mock<ConfigService>();
  const userVerificationService = mock<UserVerificationService>();

  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

  beforeEach(async () => {
    jest.clearAllMocks();

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      auth: {
        loginRequest: jest.fn(),
      },
      platform: {
        isDev: false,
        isWindowsStore: false,
        isSnapStore: false,
        powermonitor: {
          isLockMonitorAvailable: async () => false,
        },
      },
    };

    i18nService.supportedTranslationLocales = [];
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: autofillSettingsServiceAbstraction,
        },
        { provide: AccountService, useValue: accountService },
        { provide: BiometricStateService, useValue: biometricStateService },
        { provide: ConfigService, useValue: configService },
        {
          provide: DesktopAutofillSettingsService,
          useValue: desktopAutofillSettingsService,
        },
        { provide: DesktopBiometricsService, useValue: desktopBiometricsService },
        { provide: DesktopSettingsService, useValue: desktopSettingsService },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: MessageSender, useValue: mock<MessageSender>() },
        {
          provide: NativeMessagingManifestService,
          useValue: mock<NativeMessagingManifestService>(),
        },
        { provide: KeyService, useValue: keyService },
        { provide: PinServiceAbstraction, useValue: pinServiceAbstraction },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: PolicyService, useValue: policyService },
        { provide: StateService, useValue: mock<StateService>() },
        { provide: ThemeStateService, useValue: themeStateService },
        { provide: UserVerificationService, useValue: userVerificationService },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: ValidationService, useValue: validationService },
        { provide: MessagingService, useValue: messagingService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DesktopAutotypeService, useValue: desktopAutotypeService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    TestBed.overrideComponent(SettingsDialogComponent, {
      add: {
        imports: [MockSessionTimeoutSettingsComponent, MockTabGroupComponent, MockTabComponent],
        providers: [
          {
            provide: DialogService,
            useValue: dialogService,
          },
        ],
      },
      remove: {
        imports: [SessionTimeoutSettingsComponent, TabsModule],
        providers: [DialogService],
      },
    });

    // Mocks must be set up before fixture.detectChanges() because pinEnabled is
    // defined at class level and toSignal() subscribes during construction.
    desktopBiometricsService.hasPersistentKey.mockResolvedValue(false);
    vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(false);
    biometricStateService.promptAutomatically$.mockReturnValue(of(false));
    autofillSettingsServiceAbstraction.clearClipboardDelay$ = of(null);
    desktopSettingsService.minimizeOnCopy$ = of(false);
    desktopSettingsService.runInBackground$ = of(false);
    desktopSettingsService.openAtLogin$ = of(false);
    desktopSettingsService.browserIntegrationEnabled$ = of(false);
    desktopSettingsService.hardwareAcceleration$ = of(false);
    desktopSettingsService.sshAgentEnabled$ = of(false);
    desktopSettingsService.sshAgentPromptBehavior$ = of(SshAgentPromptType.Always);
    desktopSettingsService.preventScreenshots$ = of(false);
    domainSettingsService.showFavicons$ = of(false);
    desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$ = of(false);
    themeStateService.selectedTheme$ = of(ThemeType.System);
    i18nService.userSetLocale$ = of("en");
    pinServiceAbstraction.isPinSet.mockResolvedValue(false);
    policyService.policiesByType$.mockReturnValue(of([null]));
    desktopAutotypeService.autotypeEnabledUserSetting$ = of(false);
    desktopAutotypeService.autotypeKeyboardShortcut$ = of(["Control", "Alt", "B"]);
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    configService.getFeatureFlag$.mockReturnValue(of(false));

    fixture = TestBed.createComponent(SettingsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  it("pin enabled when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();

    expect((component as any).pinEnabled()).toBe(true);
  });

  it("pin enabled when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;
    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    expect((component as any).pinEnabled()).toBe(true);
  });

  it("pin disabled when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;
    policyService.policiesByType$.mockReturnValue(of([policy]));

    const account = await firstValueFrom(accountService.activeAccount$);
    accountService.activeAccountSubject.next(account);

    await component.ngOnInit();

    expect((component as any).pinEnabled()).toBe(false);
  });

  it("pin visible when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("input[formControlName='pin']"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
    expect(pinInputElement.attributes).toMatchObject({
      type: "checkbox",
    });
  });

  it("pin visible when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;
    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("input[formControlName='pin']"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
    expect(pinInputElement.attributes).toMatchObject({
      type: "checkbox",
    });
  });

  it("pin visible when RemoveUnlockWithPin policy is enabled and pin set", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;
    policyService.policiesByType$.mockReturnValue(of([policy]));
    pinServiceAbstraction.isPinSet.mockResolvedValue(true);

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("input[formControlName='pin']"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
    expect(pinInputElement.attributes).toMatchObject({
      type: "checkbox",
    });
  });

  it("pin not visible when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;
    policyService.policiesByType$.mockReturnValue(of([policy]));

    // Re-trigger pinEnabled by re-emitting the active account so toSignal()
    // picks up the new policiesByType$ mock value.
    const account = await firstValueFrom(accountService.activeAccount$);
    accountService.activeAccountSubject.next(account);

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("input[formControlName='pin']"));
    expect(pinInputElement).toBeNull();
  });

  describe("biometrics enabled", () => {
    beforeEach(() => {
      desktopBiometricsService.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);
      desktopBiometricsService.canEnableBiometricUnlock.mockResolvedValue(true);
      vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(true);
    });

    describe("windows desktop", () => {
      beforeEach(() => {
        platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);

        // Recreate component to apply the correct device
        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;
      });

      test.each([true, false])(
        `correct message display for require MP/PIN on app restart when pin is set, windows desktop, and policy is %s`,
        async (policyEnabled) => {
          const policy = new Policy();
          policy.type = PolicyType.RemoveUnlockWithPin;
          policy.enabled = policyEnabled;
          policyService.policiesByType$.mockReturnValue(of([policy]));
          platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
          pinServiceAbstraction.isPinSet.mockResolvedValue(true);

          const account = await firstValueFrom(accountService.activeAccount$);
          accountService.activeAccountSubject.next(account);

          await component.ngOnInit();
          fixture.detectChanges();

          const textNodes = checkRequireMasterPasswordOnAppRestartElement(fixture);

          if (policyEnabled) {
            expect(textNodes).toContain("requireMasterPasswordOnAppRestart");
          } else {
            expect(textNodes).toContain("requireMasterPasswordOrPinOnAppRestart");
          }
        },
      );

      describe("users without a master password", () => {
        beforeEach(() => {
          userVerificationService.hasMasterPassword.mockResolvedValue(false);
        });

        it("displays require MP/PIN on app restart checkbox when pin is set", async () => {
          pinServiceAbstraction.isPinSet.mockResolvedValue(true);

          await component.ngOnInit();
          fixture.detectChanges();

          checkRequireMasterPasswordOnAppRestartElement(fixture);
        });

        it("does not display require MP/PIN on app restart checkbox when pin is not set", async () => {
          pinServiceAbstraction.isPinSet.mockResolvedValue(false);

          await component.ngOnInit();
          fixture.detectChanges();

          const requireMasterPasswordOnAppRestartInput = fixture.debugElement.query(
            By.css("input[formControlName='requireMasterPasswordOnAppRestart']"),
          );
          expect(requireMasterPasswordOnAppRestartInput).toBeNull();
        });
      });

      function checkRequireMasterPasswordOnAppRestartElement(
        fix: ComponentFixture<SettingsDialogComponent>,
      ) {
        const inputElement = fix.debugElement.query(
          By.css("input[formControlName='requireMasterPasswordOnAppRestart']"),
        );
        expect(inputElement).not.toBeNull();
        expect(inputElement.name).toBe("input");
        expect(inputElement.attributes).toMatchObject({
          type: "checkbox",
        });

        // Get text from the bit-label sibling within the same bit-form-control
        const formControlElement = inputElement.parent;
        const labelElement = formControlElement?.query(By.css("bit-label"));
        const textContent = labelElement?.nativeElement.textContent?.trim();
        return [textContent];
      }
    });
  });

  describe("updatePinHandler", () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    test.each([true, false])(`handles thrown errors when updated pin to %s`, async (update) => {
      const error = new Error("Test error");
      jest.spyOn(component as any, "updatePin").mockRejectedValue(error);

      await component.ngOnInit();
      await (component as any).updatePinHandler(update);

      expect(logService.error).toHaveBeenCalled();
      expect((component as any).form.controls.pin.value).toBe(!update);
      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
    });

    describe("when updating to true", () => {
      it("sets pin form control to false when the PIN dialog is cancelled", async () => {
        jest.spyOn(SetPinComponent, "open").mockReturnValue(null);

        await component.ngOnInit();
        await (component as any).updatePinHandler(true);

        expect((component as any).form.controls.pin.value).toBe(false);
        expect(pinServiceAbstraction.unsetPin).not.toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      test.each([true, false])(
        `sets the pin form control to the dialog result`,
        async (dialogResult) => {
          const mockDialogRef = {
            closed: of(dialogResult),
          } as DialogRef<boolean>;
          jest.spyOn(SetPinComponent, "open").mockReturnValue(mockDialogRef);

          await component.ngOnInit();
          await (component as any).updatePinHandler(true);

          expect((component as any).form.controls.pin.value).toBe(dialogResult);
          expect(pinServiceAbstraction.unsetPin).not.toHaveBeenCalled();
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
    });

    describe("when updating to false", () => {
      it("sets the pin form control to false and clears vault timeout", async () => {
        await component.ngOnInit();
        await (component as any).updatePinHandler(false);

        expect((component as any).form.controls.pin.value).toBe(false);
        expect(pinServiceAbstraction.unsetPin).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      describe("when windows biometric v2 feature flag is enabled", () => {
        beforeEach(() => {
          keyService.userKey$.mockReturnValue(of(mockUserKey));
        });

        test.each([false, true])(
          "enrolls persistent biometric if needed, enrolled is %s",
          async (enrolled) => {
            desktopBiometricsService.hasPersistentKey.mockResolvedValue(enrolled);

            await component.ngOnInit();
            (component as any).isWindows = true;
            (component as any).form.value.requireMasterPasswordOnAppRestart = true;
            (component as any).userHasMasterPassword.set(false);
            (component as any).supportsBiometric.set(true);
            (component as any).form.value.biometric = true;

            await (component as any).updatePinHandler(false);

            expect((component as any).form.controls.requireMasterPasswordOnAppRestart.value).toBe(
              false,
            );
            expect((component as any).form.controls.pin.value).toBe(false);
            expect(pinServiceAbstraction.unsetPin).toHaveBeenCalled();
            expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");

            if (enrolled) {
              expect(desktopBiometricsService.enrollPersistent).not.toHaveBeenCalled();
            } else {
              expect(desktopBiometricsService.enrollPersistent).toHaveBeenCalledWith(
                mockUserId,
                mockUserKey,
              );
            }
          },
        );

        test.each([
          {
            userHasMasterPassword: true,
            supportsBiometric: false,
            biometric: false,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: true,
            supportsBiometric: false,
            biometric: false,
            requireMasterPasswordOnAppRestart: true,
          },
          {
            userHasMasterPassword: true,
            supportsBiometric: false,
            biometric: true,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: true,
            supportsBiometric: false,
            biometric: true,
            requireMasterPasswordOnAppRestart: true,
          },
          {
            userHasMasterPassword: true,
            supportsBiometric: true,
            biometric: false,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: true,
            supportsBiometric: true,
            biometric: false,
            requireMasterPasswordOnAppRestart: true,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: false,
            biometric: false,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: false,
            biometric: false,
            requireMasterPasswordOnAppRestart: true,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: false,
            biometric: true,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: false,
            biometric: true,
            requireMasterPasswordOnAppRestart: true,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: true,
            biometric: false,
            requireMasterPasswordOnAppRestart: false,
          },
          {
            userHasMasterPassword: false,
            supportsBiometric: true,
            biometric: false,
            requireMasterPasswordOnAppRestart: true,
          },
        ])(
          "does not enroll persistent biometric when conditions are not met: userHasMasterPassword=$userHasMasterPassword, supportsBiometric=$supportsBiometric, biometric=$biometric, requireMasterPasswordOnAppRestart=$requireMasterPasswordOnAppRestart",
          async ({
            userHasMasterPassword,
            supportsBiometric,
            biometric,
            requireMasterPasswordOnAppRestart,
          }) => {
            desktopBiometricsService.hasPersistentKey.mockResolvedValue(false);

            await component.ngOnInit();
            (component as any).isWindows = true;
            (component as any).form.value.requireMasterPasswordOnAppRestart =
              requireMasterPasswordOnAppRestart;
            (component as any).userHasMasterPassword.set(userHasMasterPassword);
            (component as any).supportsBiometric.set(supportsBiometric);
            (component as any).form.value.biometric = biometric;

            await (component as any).updatePinHandler(false);

            expect((component as any).form.controls.pin.value).toBe(false);
            expect(pinServiceAbstraction.unsetPin).toHaveBeenCalled();
            expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
            expect(desktopBiometricsService.enrollPersistent).not.toHaveBeenCalled();
          },
        );
      });
    });
  });

  describe("updateBiometricHandler", () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    test.each([true, false])(
      `handles thrown errors when updated biometrics to %s`,
      async (update) => {
        const error = new Error("Test error");
        jest.spyOn(component as any, "updateBiometric").mockRejectedValue(error);

        await component.ngOnInit();
        await (component as any).updateBiometricHandler(update);

        expect(logService.error).toHaveBeenCalled();
        expect((component as any).form.controls.biometric.value).toBe(false);
        expect(validationService.showError).toHaveBeenCalledWith(error);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      },
    );

    describe("when updating to true", () => {
      beforeEach(async () => {
        await component.ngOnInit();
        (component as any).supportsBiometric.set(true);
      });

      it("calls services to clear biometrics when supportsBiometric is false", async () => {
        (component as any).supportsBiometric.set(false);
        await (component as any).updateBiometricHandler(true);

        expect((component as any).form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(
          false,
          mockUserId,
        );
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      test.each([true, false])(
        `launches a dialog and exits when man setup is needed, dialog result is %s`,
        async (dialogResult) => {
          dialogService.openSimpleDialog.mockResolvedValue(dialogResult);
          desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
            BiometricsStatus.ManualSetupNeeded,
          );

          await (component as any).updateBiometricHandler(true);

          expect(biometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
          expect(keyService.refreshAdditionalKeys).not.toHaveBeenCalled();
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");

          if (dialogResult) {
            expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
              "https://bitwarden.com/help/biometrics/",
            );
          } else {
            expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
          }
        },
      );

      it("sets up biometrics when auto setup is needed", async () => {
        desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
          BiometricsStatus.AutoSetupNeeded,
        );
        desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(
          BiometricsStatus.Available,
        );

        await (component as any).updateBiometricHandler(true);

        expect(desktopBiometricsService.setupBiometrics).toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          true,
          mockUserId,
        );
        expect((component as any).form.controls.biometric.value).toBe(true);
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      describe("windows test cases", () => {
        beforeEach(() => {
          platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
          keyService.userKey$.mockReturnValue(of(mockUserKey));
          (component as any).isWindows = true;
          (component as any).isLinux = false;

          desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
            BiometricsStatus.Available,
          );
          desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(
            BiometricsStatus.Available,
          );
        });

        it("handles windows case", async () => {
          await (component as any).updateBiometricHandler(true);

          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
            true,
            mockUserId,
          );
          expect((component as any).form.controls.autoPromptBiometrics.value).toBe(false);
          expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(
            false,
            mockUserId,
          );
          expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
          expect((component as any).form.controls.biometric.value).toBe(true);
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        });

        describe("when windows v2 biometrics is enabled", () => {
          beforeEach(() => {
            keyService.userKey$.mockReturnValue(of(mockUserKey));
          });

          it("when the user doesn't have a master password or a PIN set, allows biometric unlock on app restart", async () => {
            (component as any).userHasMasterPassword.set(false);
            (component as any).userHasPinSet.set(false);
            desktopBiometricsService.hasPersistentKey.mockResolvedValue(false);

            await (component as any).updateBiometricHandler(true);

            expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
            expect(desktopBiometricsService.enrollPersistent).toHaveBeenCalledWith(
              mockUserId,
              mockUserKey,
            );
            expect((component as any).form.controls.requireMasterPasswordOnAppRestart.value).toBe(
              false,
            );

            expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
              true,
              mockUserId,
            );
            expect((component as any).form.controls.autoPromptBiometrics.value).toBe(false);
            expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(
              false,
              mockUserId,
            );
            expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
            expect((component as any).form.controls.biometric.value).toBe(true);
            expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
          });

          test.each([
            [true, true],
            [true, false],
            [false, true],
          ])(
            "when the userHasMasterPassword is %s and userHasPinSet is %s, require master password/PIN on app restart is the default setting",
            async (userHasMasterPassword, userHasPinSet) => {
              (component as any).userHasMasterPassword.set(userHasMasterPassword);
              (component as any).userHasPinSet.set(userHasPinSet);

              await (component as any).updateBiometricHandler(true);

              expect(desktopBiometricsService.enrollPersistent).not.toHaveBeenCalled();
              expect((component as any).form.controls.requireMasterPasswordOnAppRestart.value).toBe(
                true,
              );
              expect(desktopBiometricsService.deleteBiometricUnlockKeyForUser).toHaveBeenCalledWith(
                mockUserId,
              );
              expect(
                desktopBiometricsService.setBiometricProtectedUnlockKeyForUser,
              ).toHaveBeenCalledWith(mockUserId, mockUserKey);

              expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
                true,
                mockUserId,
              );
              expect((component as any).form.controls.autoPromptBiometrics.value).toBe(false);
              expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(
                false,
                mockUserId,
              );
              expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
              expect((component as any).form.controls.biometric.value).toBe(true);
              expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
            },
          );
        });
      });

      it("handles linux case", async () => {
        desktopBiometricsService.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);
        desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(
          BiometricsStatus.Available,
        );

        (component as any).isWindows = false;
        (component as any).isLinux = true;
        await (component as any).updateBiometricHandler(true);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          true,
          mockUserId,
        );
        expect((component as any).form.controls.autoPromptBiometrics.value).toBe(false);
        expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(
          false,
          mockUserId,
        );
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect((component as any).form.controls.biometric.value).toBe(true);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      it.each([
        BiometricsStatus.UnlockNeeded,
        BiometricsStatus.HardwareUnavailable,
        BiometricsStatus.AutoSetupNeeded,
        BiometricsStatus.ManualSetupNeeded,
        BiometricsStatus.PlatformUnsupported,
        BiometricsStatus.DesktopDisconnected,
        BiometricsStatus.NotEnabledLocally,
        BiometricsStatus.NotEnabledInConnectedDesktopApp,
      ])(
        `disables biometric when biometrics status check for the user returns %s`,
        async (status) => {
          desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
            BiometricsStatus.Available,
          );
          desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(status);

          await (component as any).updateBiometricHandler(true);

          expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
          expect((component as any).form.controls.biometric.value).toBe(false);
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
            true,
            mockUserId,
          );
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledTimes(2);
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(
            false,
            mockUserId,
          );
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
    });

    describe("when updating to false", () => {
      it("calls services to clear biometrics", async () => {
        await component.ngOnInit();
        await (component as any).updateBiometricHandler(false);

        expect((component as any).form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(
          false,
          mockUserId,
        );
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });
    });
  });

  describe("updateRequireMasterPasswordOnAppRestartHandler", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      keyService.userKey$.mockReturnValue(of(mockUserKey));
    });

    test.each([true, false])(`handles thrown errors when updated to %s`, async (update) => {
      const error = new Error("Test error");
      jest
        .spyOn(component as any, "updateRequireMasterPasswordOnAppRestart")
        .mockRejectedValue(error);

      await component.ngOnInit();
      await (component as any).updateRequireMasterPasswordOnAppRestartHandler(update, mockUserId);

      expect(logService.error).toHaveBeenCalled();
      expect(validationService.showError).toHaveBeenCalledWith(error);
    });

    describe("when updating to true", () => {
      it("calls the biometrics service to clear and reset biometric key", async () => {
        await component.ngOnInit();
        await (component as any).updateRequireMasterPasswordOnAppRestartHandler(true, mockUserId);

        expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
        expect(desktopBiometricsService.deleteBiometricUnlockKeyForUser).toHaveBeenCalledWith(
          mockUserId,
        );
        expect(desktopBiometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
          mockUserId,
          mockUserKey,
        );
      });
    });

    describe("when updating to false", () => {
      it("doesn't enroll persistent biometric if already enrolled", async () => {
        await component.ngOnInit();
        await (component as any).updateRequireMasterPasswordOnAppRestartHandler(false, mockUserId);

        expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
        expect(desktopBiometricsService.enrollPersistent).toHaveBeenCalledWith(
          mockUserId,
          mockUserKey,
        );
        expect((component as any).form.controls.requireMasterPasswordOnAppRestart.value).toBe(
          false,
        );
      });
    });
  });

  describe("desktop autotype", () => {
    it("autotype should be hidden on mac os", async () => {
      // Set OS
      platformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);

      // Recreate component to apply the correct device
      fixture = TestBed.createComponent(SettingsDialogComponent);
      component = fixture.componentInstance;

      await component.ngOnInit();
      fixture.detectChanges();

      // `enableAutotype` input shouldn't be found
      const enableAutotypeInput = fixture.debugElement.query(
        By.css("input[formControlName='enableAutotype']"),
      );
      expect(enableAutotypeInput).toBeNull();

      // `showEnableAutotype` signal should be false
      expect((component as any).showEnableAutotype()).toBe(false);
    });
  });

  describe("clearClipboard valueChanges", () => {
    it("saves the new clear clipboard value when changed", async () => {
      await component.ngOnInit();

      component["form"].controls.clearClipboard.setValue(ClearClipboardDelay.ThirtySeconds);

      expect(autofillSettingsServiceAbstraction.setClearClipboardDelay).toHaveBeenLastCalledWith(
        ClearClipboardDelay.ThirtySeconds,
      );
    });
  });

  describe("sshAgentPromptBehavior valueChanges", () => {
    it("saves the new ssh agent prompt behavior value when changed", async () => {
      await component.ngOnInit();

      component["form"].controls.sshAgentPromptBehavior.setValue(SshAgentPromptType.Never);

      expect(desktopSettingsService.setSshAgentPromptBehavior).toHaveBeenLastCalledWith(
        SshAgentPromptType.Never,
      );
    });
  });

  describe("theme valueChanges", () => {
    it("saves the new theme value when changed", async () => {
      await component.ngOnInit();

      component["form"].controls.theme.setValue(ThemeType.Dark);

      expect(themeStateService.setSelectedTheme).toHaveBeenLastCalledWith(ThemeType.Dark);
    });
  });

  describe("locale valueChanges", () => {
    it("saves the new locale value when changed", async () => {
      await component.ngOnInit();

      component["form"].controls.locale.setValue("fr");

      expect(i18nService.setLocale).toHaveBeenLastCalledWith("fr");
    });
  });
});
