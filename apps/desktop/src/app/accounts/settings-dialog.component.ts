// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, OnInit, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { concatMap, map, switchMap, timeout } from "rxjs/operators";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ClearClipboardDelay } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClearClipboardDelaySetting } from "@bitwarden/common/autofill/types";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  ButtonModule,
  CheckboxModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  ItemModule,
  LinkModule,
  Option,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TabsModule,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService, BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";
import { I18nPipe } from "@bitwarden/ui-common";
import { PermitCipherDetailsPopoverComponent } from "@bitwarden/vault";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { AutotypeShortcutComponent } from "../../autofill/components/autotype-shortcut.component";
import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { DesktopPremiumUpgradePromptService } from "../../billing/services/desktop-premium-upgrade-prompt.service";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { NativeMessagingManifestService } from "../services/native-messaging-manifest.service";

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "settings-dialog.component.html",
  standalone: true,
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  imports: [
    ButtonModule,
    CheckboxModule,
    DialogModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    IconModule,
    ItemModule,
    I18nPipe,
    LinkModule,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TabsModule,
    TypographyModule,
    SessionTimeoutSettingsComponent,
    PermitCipherDetailsPopoverComponent,
    PremiumBadgeComponent,
  ],
})
export class SettingsDialogComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly policyService = inject(PolicyService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly stateService = inject(StateService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction);
  private readonly messagingService = inject(MessagingService);
  private readonly keyService = inject(KeyService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly domainSettingsService = inject(DomainSettingsService);
  private readonly dialogService = inject(DialogService);
  private readonly userVerificationService = inject(UserVerificationServiceAbstraction);
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly desktopAutotypeService = inject(DesktopAutotypeService);
  private readonly biometricStateService = inject(BiometricStateService);
  private readonly biometricsService = inject(DesktopBiometricsService);
  private readonly desktopAutofillSettingsService = inject(DesktopAutofillSettingsService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly logService = inject(LogService);
  private readonly nativeMessagingManifestService = inject(NativeMessagingManifestService);
  private readonly configService = inject(ConfigService);
  private readonly validationService = inject(ValidationService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly localeOptions: Option<string>[];
  protected readonly themeOptions: Option<string>[];
  protected readonly clearClipboardOptions: Option<string>[];
  protected readonly sshAgentPromptBehaviorOptions: Option<string>[];

  protected readonly isWindows: boolean;
  protected readonly isLinux: boolean;
  protected readonly isMac: boolean;
  protected readonly requireEnableTray: boolean;
  protected readonly showOpenAtLoginOption: boolean;
  protected readonly showDuckDuckGoIntegrationOption: boolean;
  protected readonly enableTrayText: string;
  protected readonly enableTrayDescText: string;
  protected readonly enableMinToTrayText: string;
  protected readonly enableMinToTrayDescText: string;
  protected readonly enableCloseToTrayText: string;
  protected readonly enableCloseToTrayDescText: string;

  protected readonly supportsBiometric = signal(false);
  protected readonly showEnableAutotype = signal(false);
  protected readonly showMinToTray: boolean;
  protected readonly showAlwaysShowDock: boolean;
  private readonly activeAccount = toSignal(this.accountService.activeAccount$, {
    requireSync: true,
  });
  protected readonly currentUserEmail = computed(() => this.activeAccount().email);
  protected readonly currentUserId = computed(() => this.activeAccount().id);
  protected readonly userHasMasterPassword = signal(false);
  protected readonly userHasPinSet = signal(false);

  protected readonly pinEnabled = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.RemoveUnlockWithPin, userId),
      ),
      getFirstPolicy,
      map((policy) => policy == null || !policy.enabled),
    ),
    { initialValue: true },
  );
  protected readonly refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);

  protected readonly form = this.formBuilder.group({
    // Security
    pin: [null as boolean | null],
    biometric: false,
    requireMasterPasswordOnAppRestart: true,
    autoPromptBiometrics: false,
    // Account Preferences
    clearClipboard: [null],
    minimizeOnCopyToClipboard: false,
    enableFavicons: false,
    // App Settings
    enableTray: false,
    enableMinToTray: false,
    enableCloseToTray: false,
    openAtLogin: false,
    alwaysShowDock: false,
    enableBrowserIntegration: false,
    enableHardwareAcceleration: true,
    enableSshAgent: false,
    sshAgentPromptBehavior: SshAgentPromptType.Always,
    allowScreenshots: false,
    enableDuckDuckGoBrowserIntegration: false,
    enableAutotype: this.formBuilder.control<boolean>({
      value: false,
      disabled: true,
    }),
    autotypeShortcut: [null as string | null],
    theme: [null as Theme | null],
    locale: [null as string | null],
  });

  constructor() {
    this.isMac = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
    this.isLinux = this.platformUtilsService.getDevice() === DeviceType.LinuxDesktop;
    this.isWindows = this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;
    this.showMinToTray = !this.isLinux;
    this.showAlwaysShowDock = this.isMac;

    // Workaround to avoid ghosting trays https://github.com/electron/electron/issues/17622
    this.requireEnableTray = this.platformUtilsService.getDevice() === DeviceType.LinuxDesktop;

    const trayKey = this.isMac ? "enableMenuBar" : "enableTray";
    this.enableTrayText = this.i18nService.t(trayKey);
    this.enableTrayDescText = this.i18nService.t(trayKey + "Desc");

    const minToTrayKey = this.isMac ? "enableMinToMenuBar" : "enableMinToTray";
    this.enableMinToTrayText = this.i18nService.t(minToTrayKey);
    this.enableMinToTrayDescText = this.i18nService.t(minToTrayKey + "Desc");

    const closeToTrayKey = this.isMac ? "enableCloseToMenuBar" : "enableCloseToTray";
    this.enableCloseToTrayText = this.i18nService.t(closeToTrayKey);
    this.enableCloseToTrayDescText = this.i18nService.t(closeToTrayKey + "Desc");

    this.showOpenAtLoginOption = this.showAutostartSetting();

    // DuckDuckGo browser is only for macos initially
    this.showDuckDuckGoIntegrationOption = this.isMac;

    const localeOptions: Option<string>[] = [];
    this.i18nService.supportedTranslationLocales.forEach((locale) => {
      let name = locale;
      if (this.i18nService.localeNames.has(locale)) {
        name += " - " + this.i18nService.localeNames.get(locale);
      }
      localeOptions.push({ label: name, value: locale });
    });
    localeOptions.sort(Utils.getSortFunction(this.i18nService, "label"));
    localeOptions.splice(0, 0, { label: this.i18nService.t("default"), value: null });
    this.localeOptions = localeOptions;

    this.themeOptions = [
      { label: this.i18nService.t("default"), value: ThemeTypes.System },
      { label: this.i18nService.t("light"), value: ThemeTypes.Light },
      { label: this.i18nService.t("dark"), value: ThemeTypes.Dark },
    ];

    this.clearClipboardOptions = [
      { label: this.i18nService.t("never"), value: ClearClipboardDelay.Never },
      { label: this.i18nService.t("tenSeconds"), value: ClearClipboardDelay.TenSeconds },
      { label: this.i18nService.t("twentySeconds"), value: ClearClipboardDelay.TwentySeconds },
      { label: this.i18nService.t("thirtySeconds"), value: ClearClipboardDelay.ThirtySeconds },
      { label: this.i18nService.t("oneMinute"), value: ClearClipboardDelay.OneMinute },
      { label: this.i18nService.t("twoMinutes"), value: ClearClipboardDelay.TwoMinutes },
      { label: this.i18nService.t("fiveMinutes"), value: ClearClipboardDelay.FiveMinutes },
    ];
    this.sshAgentPromptBehaviorOptions = [
      {
        label: this.i18nService.t("sshAgentPromptBehaviorAlways"),
        value: SshAgentPromptType.Always,
      },
      { label: this.i18nService.t("sshAgentPromptBehaviorNever"), value: SshAgentPromptType.Never },
      {
        label: this.i18nService.t("sshAgentPromptBehaviorRememberUntilLock"),
        value: SshAgentPromptType.RememberUntilLock,
      },
    ];
  }

  async ngOnInit() {
    // Autotype is for Windows initially
    if (this.isWindows) {
      this.configService
        .getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((enabled) => {
          this.showEnableAutotype.set(enabled);
        });
    }

    this.userHasMasterPassword.set(await this.userVerificationService.hasMasterPassword());

    this.userHasPinSet.set(await this.pinService.isPinSet(this.currentUserId()));

    const initialValues = {
      pin: this.userHasPinSet(),
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(this.currentUserId()),
      requireMasterPasswordOnAppRestart: !(await this.biometricsService.hasPersistentKey(
        this.currentUserId(),
      )),
      autoPromptBiometrics: await firstValueFrom(this.biometricStateService.promptAutomatically$),
      clearClipboard: await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$),
      minimizeOnCopyToClipboard: await firstValueFrom(this.desktopSettingsService.minimizeOnCopy$),
      enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
      enableTray: await firstValueFrom(this.desktopSettingsService.trayEnabled$),
      enableMinToTray: await firstValueFrom(this.desktopSettingsService.minimizeToTray$),
      enableCloseToTray: await firstValueFrom(this.desktopSettingsService.closeToTray$),
      openAtLogin: await firstValueFrom(this.desktopSettingsService.openAtLogin$),
      alwaysShowDock: await firstValueFrom(this.desktopSettingsService.alwaysShowDock$),
      enableBrowserIntegration: await firstValueFrom(
        this.desktopSettingsService.browserIntegrationEnabled$,
      ),
      enableDuckDuckGoBrowserIntegration: await firstValueFrom(
        this.desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$,
      ),
      enableHardwareAcceleration: await firstValueFrom(
        this.desktopSettingsService.hardwareAcceleration$,
      ),
      enableSshAgent: await firstValueFrom(this.desktopSettingsService.sshAgentEnabled$),
      sshAgentPromptBehavior: await firstValueFrom(
        this.desktopSettingsService.sshAgentPromptBehavior$,
      ),
      allowScreenshots: !(await firstValueFrom(this.desktopSettingsService.preventScreenshots$)),
      enableAutotype: await firstValueFrom(this.desktopAutotypeService.autotypeEnabledUserSetting$),
      autotypeShortcut: this.getFormattedAutotypeShortcutText(
        (await firstValueFrom(this.desktopAutotypeService.autotypeKeyboardShortcut$)) ?? [],
      ),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      locale: await firstValueFrom(this.i18nService.userSetLocale$),
    };
    this.form.setValue(initialValues, { emitEvent: false });

    if (this.isWindows) {
      this.billingAccountProfileStateService
        .hasPremiumFromAnySource$(this.currentUserId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((hasPremium) => {
          if (hasPremium) {
            this.form.controls.enableAutotype.enable();
          }
        });
    }

    // Form events
    this.form.controls.pin.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updatePinHandler(value);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateBiometricHandler(enabled);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.requireMasterPasswordOnAppRestart.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updateRequireMasterPasswordOnAppRestartHandler(value, this.currentUserId());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.clearClipboard.valueChanges
      .pipe(
        concatMap(async (value: ClearClipboardDelaySetting) => this.saveClearClipboard(value)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.sshAgentPromptBehavior.valueChanges
      .pipe(
        concatMap(async (value: SshAgentPromptType) => this.saveSshAgentPromptBehavior(value)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.theme.valueChanges
      .pipe(
        concatMap(async (value: Theme) => this.saveTheme(value)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.locale.valueChanges
      .pipe(
        concatMap(async (value: string) => this.saveLocale(value)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.supportsBiometric.set(await this.biometricsService.canEnableBiometricUnlock());
    const timerId = setInterval(async () => {
      this.supportsBiometric.set(await this.biometricsService.canEnableBiometricUnlock());
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timerId));
  }

  private async updatePinHandler(value: boolean) {
    try {
      await this.updatePin(value);
    } catch (error) {
      this.logService.error("Error updating unlock with PIN: ", error);
      this.form.controls.pin.setValue(!value, { emitEvent: false });
      this.validationService.showError(error);
    } finally {
      this.messagingService.send("redrawMenu");
    }
  }

  private async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      const pinSet = await firstValueFrom(dialogRef.closed);
      this.userHasPinSet.set(pinSet);
      this.form.controls.pin.setValue(this.userHasPinSet(), { emitEvent: false });
    } else {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      // On Windows if a user turned off PIN without having a MP and has biometrics + require MP/PIN on restart enabled.
      if (
        this.isWindows &&
        this.supportsBiometric() &&
        this.form.value.requireMasterPasswordOnAppRestart &&
        this.form.value.biometric &&
        !this.userHasMasterPassword()
      ) {
        // Allow biometric unlock on app restart so the user doesn't get into a bad state.
        await this.enrollPersistentBiometricIfNeeded(userId);
      }
      await this.pinService.unsetPin(userId);
    }
  }

  private async updateBiometricHandler(value: boolean) {
    try {
      await this.updateBiometric(value);
    } catch (error) {
      this.logService.error("Error updating unlock with biometrics: ", error);
      this.form.controls.biometric.setValue(false, { emitEvent: false });
      this.validationService.showError(error);
    } finally {
      this.messagingService.send("redrawMenu");
    }
  }

  private async updateBiometric(enabled: boolean) {
    // NOTE: A bug in angular causes [ngModel] to not reflect the backing field value
    // causing the checkbox to remain checked even if authentication fails.
    // The bug should resolve itself once the angular issue is resolved.
    // See: https://github.com/angular/angular/issues/13063

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (!enabled || !this.supportsBiometric()) {
      this.form.controls.biometric.setValue(false, { emitEvent: false });
      await this.biometricStateService.setBiometricUnlockEnabled(false);
      await this.keyService.refreshAdditionalKeys(activeUserId);
      return;
    }

    const status = await this.biometricsService.getBiometricsStatus();

    if (status === BiometricsStatus.AutoSetupNeeded) {
      await this.biometricsService.setupBiometrics();
    } else if (status === BiometricsStatus.ManualSetupNeeded) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "biometricsManualSetupTitle" },
        content: { key: "biometricsManualSetupDesc" },
        type: "warning",
      });
      if (confirmed) {
        this.platformUtilsService.launchUri("https://bitwarden.com/help/biometrics/");
      }
      return;
    }

    await this.biometricStateService.setBiometricUnlockEnabled(true);
    if (this.isWindows) {
      // Recommended settings for Windows Hello
      this.form.controls.autoPromptBiometrics.setValue(false);
      await this.biometricStateService.setPromptAutomatically(false);

      // If the user doesn't have a MP or PIN then they have to use biometrics on app restart.
      if (!this.userHasMasterPassword() && !this.userHasPinSet()) {
        // Allow biometric unlock on app restart so the user doesn't get into a bad state.
        await this.enrollPersistentBiometricIfNeeded(activeUserId);
      } else {
        this.form.controls.requireMasterPasswordOnAppRestart.setValue(true);
      }
    } else if (this.isLinux) {
      // Similar to Windows
      this.form.controls.autoPromptBiometrics.setValue(false);
      await this.biometricStateService.setPromptAutomatically(false);
    }
    await this.keyService.refreshAdditionalKeys(activeUserId);

    // Validate the key is stored in case biometrics fail.
    const biometricSet =
      (await this.biometricsService.getBiometricsStatusForUser(activeUserId)) ===
      BiometricsStatus.Available;
    this.form.controls.biometric.setValue(biometricSet, { emitEvent: false });
    if (!biometricSet) {
      await this.biometricStateService.setBiometricUnlockEnabled(false);
    }
  }

  private async updateRequireMasterPasswordOnAppRestartHandler(enabled: boolean, userId: UserId) {
    try {
      await this.updateRequireMasterPasswordOnAppRestart(enabled, userId);
    } catch (error) {
      this.logService.error("Error updating require master password on app restart: ", error);
      this.validationService.showError(error);
    }
  }

  private async updateRequireMasterPasswordOnAppRestart(enabled: boolean, userId: UserId) {
    if (enabled) {
      // Require master password or PIN on app restart
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      await this.biometricsService.deleteBiometricUnlockKeyForUser(userId);
      await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
    } else {
      // Allow biometric unlock on app restart
      await this.enrollPersistentBiometricIfNeeded(userId);
    }
  }

  private async enrollPersistentBiometricIfNeeded(userId: UserId): Promise<void> {
    if (!(await this.biometricsService.hasPersistentKey(userId))) {
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      await this.biometricsService.enrollPersistent(userId, userKey);
      this.form.controls.requireMasterPasswordOnAppRestart.setValue(false, {
        emitEvent: false,
      });
    }
  }

  protected async updateAutoPromptBiometrics() {
    if (this.form.value.autoPromptBiometrics) {
      await this.biometricStateService.setPromptAutomatically(true);
    } else {
      await this.biometricStateService.setPromptAutomatically(false);
    }
  }

  protected async saveFavicons() {
    await this.domainSettingsService.setShowFavicons(this.form.value.enableFavicons);
    this.messagingService.send("refreshCiphers");
  }

  protected async saveMinToTray() {
    await this.desktopSettingsService.setMinimizeToTray(this.form.value.enableMinToTray);
  }

  protected async saveCloseToTray() {
    if (this.requireEnableTray) {
      this.form.controls.enableTray.setValue(true);
      await this.desktopSettingsService.setTrayEnabled(this.form.value.enableTray);
    }

    await this.desktopSettingsService.setCloseToTray(this.form.value.enableCloseToTray);
  }

  protected async saveTray() {
    if (
      this.requireEnableTray &&
      !this.form.value.enableTray &&
      this.form.value.enableCloseToTray
    ) {
      const confirm = await this.dialogService.openSimpleDialog({
        title: { key: "confirmTrayTitle" },
        content: { key: "confirmTrayDesc" },
        type: "warning",
      });

      if (confirm) {
        this.form.controls.enableCloseToTray.setValue(false, { emitEvent: false });
        await this.desktopSettingsService.setCloseToTray(this.form.value.enableCloseToTray);
      } else {
        this.form.controls.enableTray.setValue(true);
      }

      return;
    }

    await this.desktopSettingsService.setTrayEnabled(this.form.value.enableTray);
    // TODO: Ideally the DesktopSettingsService.trayEnabled$ could be subscribed to instead of using messaging.
    this.messagingService.send(this.form.value.enableTray ? "showTray" : "removeTray");
  }

  private async saveLocale(newValue: string) {
    await this.i18nService.setLocale(newValue);
  }

  private async saveTheme(newValue: Theme) {
    await this.themeStateService.setSelectedTheme(newValue);
  }

  protected async saveMinOnCopyToClipboard() {
    await this.desktopSettingsService.setMinimizeOnCopy(
      this.form.value.minimizeOnCopyToClipboard,
      this.currentUserId(),
    );
  }

  private async saveClearClipboard(newValue: ClearClipboardDelaySetting) {
    await this.autofillSettingsService.setClearClipboardDelay(newValue);
  }

  protected async saveAlwaysShowDock() {
    await this.desktopSettingsService.setAlwaysShowDock(this.form.value.alwaysShowDock);
  }

  private showAutostartSetting(): boolean {
    // Windows store does not support autostart
    // Dev mode should not show auto-start, because it would result in an empty electron window starting on login
    // Snap store has auto-start enabled through electron-builder ALWAYS
    return !ipc.platform.isWindowsStore && !ipc.platform.isDev && !ipc.platform.isSnapStore;
  }

  protected async saveOpenAtLogin() {
    await this.desktopSettingsService.setOpenAtLogin(this.form.value.openAtLogin);
    // TODO: Ideally DesktopSettingsService.openAtLogin$ could be subscribed to directly rather than sending a message
    this.messagingService.send(
      this.form.value.openAtLogin ? "addOpenAtLogin" : "removeOpenAtLogin",
    );
  }

  protected async saveBrowserIntegration() {
    const skipSupportedPlatformCheck =
      ipc.platform.allowBrowserintegrationOverride || ipc.platform.isDev;

    if (!skipSupportedPlatformCheck) {
      if (ipc.platform.isWindowsStore) {
        await this.dialogService.openSimpleDialog({
          title: { key: "browserIntegrationUnsupportedTitle" },
          content: { key: "browserIntegrationWindowsStoreDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "warning",
        });

        this.form.controls.enableBrowserIntegration.setValue(false);
        return;
      }
    }

    await this.desktopSettingsService.setBrowserIntegrationEnabled(
      this.form.value.enableBrowserIntegration,
    );

    const errorResult = await this.nativeMessagingManifestService.generate(
      this.form.value.enableBrowserIntegration,
    );
    if (errorResult !== null) {
      this.logService.error("Error in browser integration: " + errorResult);
      await this.dialogService.openSimpleDialog({
        title: { key: "browserIntegrationErrorTitle" },
        content: { key: "browserIntegrationErrorDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "danger",
      });
    }
  }

  protected async saveDdgBrowserIntegration() {
    await this.desktopAutofillSettingsService.setEnableDuckDuckGoBrowserIntegration(
      this.form.value.enableDuckDuckGoBrowserIntegration,
    );

    // Adding to cover users on a previous version of DDG
    await this.stateService.setEnableDuckDuckGoBrowserIntegration(
      this.form.value.enableDuckDuckGoBrowserIntegration,
    );

    if (!this.form.value.enableBrowserIntegration) {
      await this.stateService.setDuckDuckGoSharedKey(null);
    }

    const errorResult = await this.nativeMessagingManifestService.generateDuckDuckGo(
      this.form.value.enableDuckDuckGoBrowserIntegration,
    );
    if (errorResult !== null) {
      this.logService.error("Error in DDG browser integration: " + errorResult);
    }
  }

  protected async saveHardwareAcceleration() {
    await this.desktopSettingsService.setHardwareAcceleration(
      this.form.value.enableHardwareAcceleration,
    );
  }

  protected async saveSshAgent() {
    await this.desktopSettingsService.setSshAgentEnabled(this.form.value.enableSshAgent);
  }

  private async saveSshAgentPromptBehavior(newValue: SshAgentPromptType) {
    await this.desktopSettingsService.setSshAgentPromptBehavior(newValue);
  }

  protected async savePreventScreenshots() {
    await this.desktopSettingsService.setPreventScreenshots(!this.form.value.allowScreenshots);

    if (!this.form.value.allowScreenshots) {
      const dialogRef = this.dialogService.openSimpleDialogRef({
        title: { key: "confirmWindowStillVisibleTitle" },
        content: { key: "confirmWindowStillVisibleContent" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "info",
      });
      let enabled = true;
      try {
        enabled = await firstValueFrom(dialogRef.closed.pipe(timeout(10000)));
      } catch {
        enabled = false;
      } finally {
        await dialogRef.close();
      }

      if (!enabled) {
        await this.desktopSettingsService.setPreventScreenshots(false);
        this.form.controls.allowScreenshots.setValue(true, { emitEvent: false });
      }
    }
  }

  protected async saveEnableAutotype() {
    await this.desktopAutotypeService.setAutotypeEnabledState(this.form.value.enableAutotype);
    const currentShortcut = await firstValueFrom(
      this.desktopAutotypeService.autotypeKeyboardShortcut$,
    );
    if (currentShortcut) {
      this.form.controls.autotypeShortcut.setValue(
        this.getFormattedAutotypeShortcutText(currentShortcut),
      );
    }
  }

  protected async saveAutotypeShortcut() {
    // disable the shortcut so that the user can't re-enter the existing
    // shortcut and trigger the feature during the settings menu.
    // it is not necessary to check if it's already enabled, because
    // the edit shortcut is only available if the feature is enabled
    // in the settings.
    await this.desktopAutotypeService.setAutotypeEnabledState(false);

    const dialogRef = AutotypeShortcutComponent.open(this.dialogService);

    const newShortcutArray = await firstValueFrom(dialogRef.closed);

    // re-enable
    await this.desktopAutotypeService.setAutotypeEnabledState(true);

    if (!newShortcutArray) {
      return;
    }

    this.form.controls.autotypeShortcut.setValue(
      this.getFormattedAutotypeShortcutText(newShortcutArray),
    );
    await this.desktopAutotypeService.setAutotypeKeyboardShortcutState(newShortcutArray);
  }

  protected get biometricText() {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "unlockWithTouchId";
      case DeviceType.WindowsDesktop:
        return "unlockWithWindowsHello";
      case DeviceType.LinuxDesktop:
        return "unlockWithPolkit";
      default:
        throw new Error("Unsupported platform");
    }
  }

  private getFormattedAutotypeShortcutText(shortcut: string[]) {
    return shortcut ? shortcut.join("+").replace("Super", "Win") : null;
  }

  static open(dialogService: DialogService) {
    return dialogService.open(SettingsDialogComponent);
  }
}
