import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
  VaultTimeoutAction,
  VaultTimeout,
} from "@bitwarden/common/key-management/vault-timeout";
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
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@bitwarden/key-management";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { NativeMessagingManifestService } from "../services/native-messaging-manifest.service";

import { SettingsComponent } from "./settings.component";

describe("SettingsComponent", () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
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

  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64));

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

    TestBed.overrideComponent(SettingsComponent, {
      add: {
        providers: [
          {
            provide: DialogService,
            useValue: dialogService,
          },
        ],
      },
      remove: {
        providers: [DialogService],
      },
    });

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    desktopBiometricsService.hasPersistentKey.mockResolvedValue(false);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(false);
    biometricStateService.promptAutomatically$ = of(false);
    autofillSettingsServiceAbstraction.clearClipboardDelay$ = of(null);
    desktopSettingsService.minimizeOnCopy$ = of(false);
    desktopSettingsService.trayEnabled$ = of(false);
    desktopSettingsService.minimizeToTray$ = of(false);
    desktopSettingsService.closeToTray$ = of(false);
    desktopSettingsService.startToTray$ = of(false);
    desktopSettingsService.openAtLogin$ = of(false);
    desktopSettingsService.alwaysShowDock$ = of(false);
    desktopSettingsService.browserIntegrationEnabled$ = of(false);
    desktopSettingsService.browserIntegrationFingerprintEnabled$ = of(false);
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
    desktopAutotypeService.resolvedAutotypeEnabled$ = of(false);
    desktopAutotypeService.autotypeEnabledUserSetting$ = of(false);
    desktopAutotypeService.autotypeKeyboardShortcut$ = of(["Control", "Shift", "B"]);
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    configService.getFeatureFlag$.mockReturnValue(of(false));
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
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
  });

  it("pin disabled when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;
    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(false);
  });

  it("pin visible when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
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

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
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

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
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

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
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
        fixture = TestBed.createComponent(SettingsComponent);
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

          const requireMasterPasswordOnAppRestartLabelElement = fixture.debugElement.query(
            By.css("label[for='requireMasterPasswordOnAppRestart']"),
          );
          expect(requireMasterPasswordOnAppRestartLabelElement).toBeNull();
        });
      });

      function checkRequireMasterPasswordOnAppRestartElement(
        fixture: ComponentFixture<SettingsComponent>,
      ) {
        const requireMasterPasswordOnAppRestartLabelElement = fixture.debugElement.query(
          By.css("label[for='requireMasterPasswordOnAppRestart']"),
        );
        expect(requireMasterPasswordOnAppRestartLabelElement).not.toBeNull();
        expect(requireMasterPasswordOnAppRestartLabelElement.children).toHaveLength(1);
        expect(requireMasterPasswordOnAppRestartLabelElement.children[0].name).toBe("input");
        expect(requireMasterPasswordOnAppRestartLabelElement.children[0].attributes).toMatchObject({
          id: "requireMasterPasswordOnAppRestart",
          type: "checkbox",
        });
        const textNodes = requireMasterPasswordOnAppRestartLabelElement.childNodes
          .filter((node) => node.nativeNode.nodeType === Node.TEXT_NODE)
          .map((node) => node.nativeNode.wholeText?.trim());
        return textNodes;
      }
    });
  });

  describe("updatePinHandler", () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    test.each([true, false])(`handles thrown errors when updated pin to %s`, async (update) => {
      const error = new Error("Test error");
      jest.spyOn(component, "updatePin").mockRejectedValue(error);

      await component.ngOnInit();
      await component.updatePinHandler(update);

      expect(logService.error).toHaveBeenCalled();
      expect(component.form.controls.pin.value).toBe(!update);
      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
    });

    describe("when updating to true", () => {
      it("sets pin form control to false when the PIN dialog is cancelled", async () => {
        jest.spyOn(SetPinComponent, "open").mockReturnValue(null);

        await component.ngOnInit();
        await component.updatePinHandler(true);

        expect(component.form.controls.pin.value).toBe(false);
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
          await component.updatePinHandler(true);

          expect(component.form.controls.pin.value).toBe(dialogResult);
          expect(pinServiceAbstraction.unsetPin).not.toHaveBeenCalled();
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
    });

    describe("when updating to false", () => {
      it("sets the pin form control to false and clears vault timeout", async () => {
        await component.ngOnInit();
        await component.updatePinHandler(false);

        expect(component.form.controls.pin.value).toBe(false);
        expect(pinServiceAbstraction.unsetPin).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      describe("when windows biometric v2 feature flag is enabled", () => {
        beforeEach(() => {
          keyService.userKey$ = jest.fn().mockReturnValue(of(mockUserKey));
        });

        test.each([false, true])(
          "enrolls persistent biometric if needed, enrolled is %s",
          async (enrolled) => {
            desktopBiometricsService.hasPersistentKey.mockResolvedValue(enrolled);

            await component.ngOnInit();
            component.isWindows = true;
            component.form.value.requireMasterPasswordOnAppRestart = true;
            component.userHasMasterPassword = false;
            component.supportsBiometric = true;
            component.form.value.biometric = true;

            await component.updatePinHandler(false);

            expect(component.form.controls.requireMasterPasswordOnAppRestart.value).toBe(false);
            expect(component.form.controls.pin.value).toBe(false);
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
            component.isWindows = true;
            component.form.value.requireMasterPasswordOnAppRestart =
              requireMasterPasswordOnAppRestart;
            component.userHasMasterPassword = userHasMasterPassword;
            component.supportsBiometric = supportsBiometric;
            component.form.value.biometric = biometric;

            await component.updatePinHandler(false);

            expect(component.form.controls.pin.value).toBe(false);
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
        jest.spyOn(component, "updateBiometric").mockRejectedValue(error);

        await component.ngOnInit();
        await component.updateBiometricHandler(update);

        expect(logService.error).toHaveBeenCalled();
        expect(component.form.controls.biometric.value).toBe(false);
        expect(validationService.showError).toHaveBeenCalledWith(error);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      },
    );

    describe("when updating to true", () => {
      beforeEach(async () => {
        await component.ngOnInit();
        component.supportsBiometric = true;
      });

      it("calls services to clear biometrics when supportsBiometric is false", async () => {
        component.supportsBiometric = false;
        await component.updateBiometricHandler(true);

        expect(component.form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(false);
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

          await component.updateBiometricHandler(true);

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

        await component.updateBiometricHandler(true);

        expect(desktopBiometricsService.setupBiometrics).toHaveBeenCalled();
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
        expect(component.form.controls.biometric.value).toBe(true);
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      describe("windows test cases", () => {
        beforeEach(() => {
          platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
          keyService.userKey$ = jest.fn().mockReturnValue(of(mockUserKey));
          component.isWindows = true;
          component.isLinux = false;

          desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
            BiometricsStatus.Available,
          );
          desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(
            BiometricsStatus.Available,
          );
        });

        it("handles windows case", async () => {
          await component.updateBiometricHandler(true);

          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
          expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
          expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
          expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
          expect(component.form.controls.biometric.value).toBe(true);
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        });

        describe("when windows v2 biometrics is enabled", () => {
          beforeEach(() => {
            keyService.userKey$ = jest.fn().mockReturnValue(of(mockUserKey));
          });

          it("when the user doesn't have a master password or a PIN set, allows biometric unlock on app restart", async () => {
            component.userHasMasterPassword = false;
            component.userHasPinSet = false;
            desktopBiometricsService.hasPersistentKey.mockResolvedValue(false);

            await component.updateBiometricHandler(true);

            expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
            expect(desktopBiometricsService.enrollPersistent).toHaveBeenCalledWith(
              mockUserId,
              mockUserKey,
            );
            expect(component.form.controls.requireMasterPasswordOnAppRestart.value).toBe(false);

            expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
            expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
            expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
            expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
            expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
            expect(component.form.controls.biometric.value).toBe(true);
            expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
          });

          test.each([
            [true, true],
            [true, false],
            [false, true],
          ])(
            "when the userHasMasterPassword is %s and userHasPinSet is %s, require master password/PIN on app restart is the default setting",
            async (userHasMasterPassword, userHasPinSet) => {
              component.userHasMasterPassword = userHasMasterPassword;
              component.userHasPinSet = userHasPinSet;

              await component.updateBiometricHandler(true);

              expect(desktopBiometricsService.enrollPersistent).not.toHaveBeenCalled();
              expect(component.form.controls.requireMasterPasswordOnAppRestart.value).toBe(true);
              expect(desktopBiometricsService.deleteBiometricUnlockKeyForUser).toHaveBeenCalledWith(
                mockUserId,
              );
              expect(
                desktopBiometricsService.setBiometricProtectedUnlockKeyForUser,
              ).toHaveBeenCalledWith(mockUserId, mockUserKey);

              expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
              expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
              expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
              expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
              expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
              expect(component.form.controls.biometric.value).toBe(true);
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

        component.isWindows = false;
        component.isLinux = true;
        await component.updateBiometricHandler(true);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
        expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
        expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect(component.form.controls.biometric.value).toBe(true);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      test.each([
        BiometricsStatus.UnlockNeeded,
        BiometricsStatus.HardwareUnavailable,
        BiometricsStatus.AutoSetupNeeded,
        BiometricsStatus.ManualSetupNeeded,
        BiometricsStatus.PlatformUnsupported,
        BiometricsStatus.DesktopDisconnected,
        BiometricsStatus.NotEnabledLocally,
        BiometricsStatus.NotEnabledInConnectedDesktopApp,
        BiometricsStatus.NativeMessagingPermissionMissing,
      ])(
        `disables biometric when biometrics status check for the user returns %s`,
        async (status) => {
          desktopBiometricsService.getBiometricsStatus.mockResolvedValue(
            BiometricsStatus.Available,
          );
          desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(status);

          await component.updateBiometricHandler(true);

          expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
          expect(component.form.controls.biometric.value).toBe(false);
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledTimes(2);
          expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(false);
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
    });

    describe("when updating to false", () => {
      it("calls services to clear biometrics", async () => {
        await component.ngOnInit();
        await component.updateBiometricHandler(false);

        expect(component.form.controls.biometric.value).toBe(false);
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenLastCalledWith(false);
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });
    });
  });

  describe("updateRequireMasterPasswordOnAppRestartHandler", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      keyService.userKey$ = jest.fn().mockReturnValue(of(mockUserKey));
    });

    test.each([true, false])(`handles thrown errors when updated to %s`, async (update) => {
      const error = new Error("Test error");
      jest.spyOn(component, "updateRequireMasterPasswordOnAppRestart").mockRejectedValue(error);

      await component.ngOnInit();
      await component.updateRequireMasterPasswordOnAppRestartHandler(update, mockUserId);

      expect(logService.error).toHaveBeenCalled();
      expect(validationService.showError).toHaveBeenCalledWith(error);
    });

    describe("when updating to true", () => {
      it("calls the biometrics service to clear and reset biometric key", async () => {
        await component.ngOnInit();
        await component.updateRequireMasterPasswordOnAppRestartHandler(true, mockUserId);

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
        biometricStateService.hasPersistentKey.mockResolvedValue(false);

        await component.ngOnInit();
        await component.updateRequireMasterPasswordOnAppRestartHandler(false, mockUserId);

        expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
        expect(desktopBiometricsService.enrollPersistent).toHaveBeenCalledWith(
          mockUserId,
          mockUserKey,
        );
        expect(component.form.controls.requireMasterPasswordOnAppRestart.value).toBe(false);
      });
    });
  });

  describe("saveVaultTimeout", () => {
    const DEFAULT_VAULT_TIMEOUT: VaultTimeout = 123;
    const DEFAULT_VAULT_TIMEOUT_ACTION = VaultTimeoutAction.Lock;

    beforeEach(() => {
      component["form"].controls.vaultTimeout.setValue(DEFAULT_VAULT_TIMEOUT, { emitEvent: false });
      component["form"].controls.vaultTimeoutAction.setValue(DEFAULT_VAULT_TIMEOUT_ACTION, {
        emitEvent: false,
      });
    });

    it.each([
      null,
      [VaultTimeoutStringType.Never],
      [VaultTimeoutStringType.OnRestart],
      [VaultTimeoutStringType.OnLocked],
      [VaultTimeoutStringType.OnSleep],
      [VaultTimeoutStringType.OnIdle],
      [42],
    ])("should save vault timeout", async (vaultTimeout: VaultTimeout) => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await component.saveVaultTimeout(DEFAULT_VAULT_TIMEOUT, vaultTimeout);

      expect(vaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
        mockUserId,
        vaultTimeout,
        DEFAULT_VAULT_TIMEOUT_ACTION,
      );
    });

    it("should save vault timeout when vault timeout action is disabled", async () => {
      component["form"].controls.vaultTimeoutAction.setValue(VaultTimeoutAction.LogOut, {
        emitEvent: false,
      });
      component["form"].controls.vaultTimeoutAction.disable({ emitEvent: false });

      await component.saveVaultTimeout(DEFAULT_VAULT_TIMEOUT, DEFAULT_VAULT_TIMEOUT);

      expect(vaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_VAULT_TIMEOUT,
        VaultTimeoutAction.LogOut,
      );
    });

    it("should not save vault timeout when vault timeout is 'never' and dialog is cancelled", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.saveVaultTimeout(DEFAULT_VAULT_TIMEOUT, VaultTimeoutStringType.Never);

      expect(vaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalledWith(
        mockUserId,
        VaultTimeoutStringType.Never,
        DEFAULT_VAULT_TIMEOUT_ACTION,
      );
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });
    });

    it("should not save vault timeout when vault timeout is 0", async () => {
      component["form"].controls.vaultTimeout.setValue(0, { emitEvent: false });
      await component.saveVaultTimeout(DEFAULT_VAULT_TIMEOUT, 0);

      expect(vaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalledWith(
        mockUserId,
        0,
        DEFAULT_VAULT_TIMEOUT_ACTION,
      );
      expect(component["form"].getRawValue().vaultTimeout).toEqual(0);
    });

    it("should not save vault timeout when vault timeout is invalid", async () => {
      component["form"].controls.vaultTimeout.setErrors({}, { emitEvent: false });
      await component.saveVaultTimeout(DEFAULT_VAULT_TIMEOUT, 999_999_999);

      expect(vaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalledWith(
        mockUserId,
        999_999_999,
        DEFAULT_VAULT_TIMEOUT_ACTION,
      );
      expect(component["form"].getRawValue().vaultTimeout).toEqual(DEFAULT_VAULT_TIMEOUT);
    });
  });

  describe("desktop autotype", () => {
    it("autotype should be hidden on mac os", async () => {
      // Set OS
      platformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);

      // Recreate component to apply the correct device
      fixture = TestBed.createComponent(SettingsComponent);
      component = fixture.componentInstance;

      await component.ngOnInit();
      fixture.detectChanges();

      // `enableAutotype` label shouldn't be found
      const showEnableAutotypeLabelElement = fixture.debugElement.query(
        By.css("label[for='enableAutotype']"),
      );
      expect(showEnableAutotypeLabelElement).toBeNull();

      // `showEnableAutotype` should be false
      expect(component.showEnableAutotype).toBe(false);
    });
  });
});
