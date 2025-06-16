import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { DeviceType } from "@bitwarden/common/enums";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
  VaultTimeoutAction,
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
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@bitwarden/key-management";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
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

  beforeEach(async () => {
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

    await TestBed.configureTestingModule({
      declarations: [SettingsComponent, I18nPipe],
      providers: [
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: autofillSettingsServiceAbstraction,
        },
        { provide: AccountService, useValue: accountService },
        { provide: BiometricStateService, useValue: biometricStateService },
        { provide: ConfigService, useValue: mock<ConfigService>() },
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
        { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: ValidationService, useValue: validationService },
        { provide: MessagingService, useValue: messagingService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(false);
    biometricStateService.promptAutomatically$ = of(false);
    biometricStateService.requirePasswordOnStart$ = of(false);
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

    it("require password or pin on app start message when RemoveUnlockWithPin policy is disabled and pin set and windows desktop", async () => {
      const policy = new Policy();
      policy.type = PolicyType.RemoveUnlockWithPin;
      policy.enabled = false;
      policyService.policiesByType$.mockReturnValue(of([policy]));
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      i18nService.t.mockImplementation((id: string) => {
        if (id === "requirePasswordOnStart") {
          return "Require password or pin on app start";
        } else if (id === "requirePasswordWithoutPinOnStart") {
          return "Require password on app start";
        }
        return "";
      });
      pinServiceAbstraction.isPinSet.mockResolvedValue(true);

      await component.ngOnInit();
      fixture.detectChanges();

      const requirePasswordOnStartLabelElement = fixture.debugElement.query(
        By.css("label[for='requirePasswordOnStart']"),
      );
      expect(requirePasswordOnStartLabelElement).not.toBeNull();
      expect(requirePasswordOnStartLabelElement.children).toHaveLength(1);
      expect(requirePasswordOnStartLabelElement.children[0].name).toBe("input");
      expect(requirePasswordOnStartLabelElement.children[0].attributes).toMatchObject({
        id: "requirePasswordOnStart",
        type: "checkbox",
      });
      const textNodes = requirePasswordOnStartLabelElement.childNodes
        .filter((node) => node.nativeNode.nodeType === Node.TEXT_NODE)
        .map((node) => node.nativeNode.wholeText?.trim());
      expect(textNodes).toContain("Require password or pin on app start");
    });

    it("require password on app start message when RemoveUnlockWithPin policy is enabled and pin set and windows desktop", async () => {
      const policy = new Policy();
      policy.type = PolicyType.RemoveUnlockWithPin;
      policy.enabled = true;
      policyService.policiesByType$.mockReturnValue(of([policy]));
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      i18nService.t.mockImplementation((id: string) => {
        if (id === "requirePasswordOnStart") {
          return "Require password or pin on app start";
        } else if (id === "requirePasswordWithoutPinOnStart") {
          return "Require password on app start";
        }
        return "";
      });
      pinServiceAbstraction.isPinSet.mockResolvedValue(true);

      await component.ngOnInit();
      fixture.detectChanges();

      const requirePasswordOnStartLabelElement = fixture.debugElement.query(
        By.css("label[for='requirePasswordOnStart']"),
      );
      expect(requirePasswordOnStartLabelElement).not.toBeNull();
      expect(requirePasswordOnStartLabelElement.children).toHaveLength(1);
      expect(requirePasswordOnStartLabelElement.children[0].name).toBe("input");
      expect(requirePasswordOnStartLabelElement.children[0].attributes).toMatchObject({
        id: "requirePasswordOnStart",
        type: "checkbox",
      });
      const textNodes = requirePasswordOnStartLabelElement.childNodes
        .filter((node) => node.nativeNode.nodeType === Node.TEXT_NODE)
        .map((node) => node.nativeNode.wholeText?.trim());
      expect(textNodes).toContain("Require password on app start");
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
        expect(vaultTimeoutSettingsService.clear).not.toHaveBeenCalled();
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
          expect(vaultTimeoutSettingsService.clear).not.toHaveBeenCalled();
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
    });

    describe("when updating to false", () => {
      let updateRequirePasswordOnStartSpy: jest.SpyInstance;

      beforeEach(() => {
        updateRequirePasswordOnStartSpy = jest
          .spyOn(component, "updateRequirePasswordOnStart")
          .mockImplementation(() => Promise.resolve());
      });

      it("updates requires password on start when the user doesn't have a MP and has requirePasswordOnStart on", async () => {
        await component.ngOnInit();
        component.form.controls.requirePasswordOnStart.setValue(true, { emitEvent: false });
        component.userHasMasterPassword = false;
        await component.updatePinHandler(false);

        expect(component.form.controls.pin.value).toBe(false);
        expect(component.form.controls.requirePasswordOnStart.value).toBe(false);
        expect(updateRequirePasswordOnStartSpy).toHaveBeenCalled();
        expect(vaultTimeoutSettingsService.clear).toHaveBeenCalled();
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });

      test.each([
        [true, true],
        [false, true],
        [false, false],
      ])(
        `doesn't updates requires password on start when the user's requirePasswordOnStart is %s and userHasMasterPassword is %s`,
        async (requirePasswordOnStart, userHasMasterPassword) => {
          await component.ngOnInit();
          component.form.controls.requirePasswordOnStart.setValue(requirePasswordOnStart, {
            emitEvent: false,
          });
          component.userHasMasterPassword = userHasMasterPassword;
          await component.updatePinHandler(false);

          expect(component.form.controls.pin.value).toBe(false);
          expect(component.form.controls.requirePasswordOnStart.value).toBe(requirePasswordOnStart);
          expect(updateRequirePasswordOnStartSpy).not.toHaveBeenCalled();
          expect(vaultTimeoutSettingsService.clear).toHaveBeenCalled();
          expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
        },
      );
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

      it("handles windows case", async () => {
        desktopBiometricsService.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);
        desktopBiometricsService.getBiometricsStatusForUser.mockResolvedValue(
          BiometricsStatus.Available,
        );

        component.isWindows = true;
        component.isLinux = false;
        await component.updateBiometricHandler(true);

        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true);
        expect(component.form.controls.requirePasswordOnStart.value).toBe(true);
        expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
        expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
        expect(biometricStateService.setRequirePasswordOnStart).toHaveBeenCalledWith(true);
        expect(biometricStateService.setDismissedRequirePasswordOnStartCallout).toHaveBeenCalled();
        expect(keyService.refreshAdditionalKeys).toHaveBeenCalledWith(mockUserId);
        expect(component.form.controls.biometric.value).toBe(true);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
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
        expect(component.form.controls.requirePasswordOnStart.value).toBe(true);
        expect(component.form.controls.autoPromptBiometrics.value).toBe(false);
        expect(biometricStateService.setPromptAutomatically).toHaveBeenCalledWith(false);
        expect(biometricStateService.setRequirePasswordOnStart).toHaveBeenCalledWith(true);
        expect(biometricStateService.setDismissedRequirePasswordOnStartCallout).toHaveBeenCalled();
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
});
