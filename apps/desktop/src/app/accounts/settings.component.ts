import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, firstValueFrom, Observable, Subject } from "rxjs";
import { concatMap, debounceTime, filter, map, switchMap, takeUntil, tap } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DeviceType } from "@bitwarden/common/enums";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { ThemeType, KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DialogService } from "@bitwarden/components";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { flagEnabled } from "../../platform/flags";

@Component({
  selector: "app-settings",
  templateUrl: "settings.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SettingsComponent implements OnInit {
  // For use in template
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  showMinToTray = false;
  vaultTimeoutOptions: any[];
  localeOptions: any[];
  themeOptions: any[];
  clearClipboardOptions: any[];
  supportsBiometric: boolean;
  additionalBiometricSettingsText: string;
  showAlwaysShowDock = false;
  requireEnableTray = false;
  showDuckDuckGoIntegrationOption = false;
  isWindows: boolean;

  enableTrayText: string;
  enableTrayDescText: string;
  enableMinToTrayText: string;
  enableMinToTrayDescText: string;
  enableCloseToTrayText: string;
  enableCloseToTrayDescText: string;
  startToTrayText: string;
  startToTrayDescText: string;

  showSecurity = true;
  showAccountPreferences = true;
  showAppPreferences = true;

  currentUserEmail: string;

  availableVaultTimeoutActions$: Observable<VaultTimeoutAction[]>;
  vaultTimeoutPolicyCallout: Observable<{
    timeout: { hours: number; minutes: number };
    action: "lock" | "logOut";
  }>;
  previousVaultTimeout: number = null;

  userHasMasterPassword: boolean;
  userHasPinSet: boolean;

  form = this.formBuilder.group({
    // Security
    vaultTimeout: [null as number | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    pin: [null as boolean | null],
    biometric: false,
    autoPromptBiometrics: false,
    requirePasswordOnStart: false,
    approveLoginRequests: false,
    // Account Preferences
    clearClipboard: [null],
    minimizeOnCopyToClipboard: false,
    enableFavicons: false,
    // App Settings
    enableTray: false,
    enableMinToTray: false,
    enableCloseToTray: false,
    startToTray: false,
    openAtLogin: false,
    alwaysShowDock: false,
    enableBrowserIntegration: false,
    enableBrowserIntegrationFingerprint: this.formBuilder.control<boolean>({
      value: false,
      disabled: true,
    }),
    enableDuckDuckGoBrowserIntegration: false,
    theme: [null as ThemeType | null],
    locale: [null as string | null],
  });

  private refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private stateService: StateService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private messagingService: MessagingService,
    private cryptoService: CryptoService,
    private modalService: ModalService,
    private themeStateService: ThemeStateService,
    private settingsService: SettingsService,
    private dialogService: DialogService,
    private userVerificationService: UserVerificationServiceAbstraction,
    private biometricStateService: BiometricStateService,
  ) {
    const isMac = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;

    // Workaround to avoid ghosting trays https://github.com/electron/electron/issues/17622
    this.requireEnableTray = this.platformUtilsService.getDevice() === DeviceType.LinuxDesktop;

    const trayKey = isMac ? "enableMenuBar" : "enableTray";
    this.enableTrayText = this.i18nService.t(trayKey);
    this.enableTrayDescText = this.i18nService.t(trayKey + "Desc");

    const minToTrayKey = isMac ? "enableMinToMenuBar" : "enableMinToTray";
    this.enableMinToTrayText = this.i18nService.t(minToTrayKey);
    this.enableMinToTrayDescText = this.i18nService.t(minToTrayKey + "Desc");

    const closeToTrayKey = isMac ? "enableCloseToMenuBar" : "enableCloseToTray";
    this.enableCloseToTrayText = this.i18nService.t(closeToTrayKey);
    this.enableCloseToTrayDescText = this.i18nService.t(closeToTrayKey + "Desc");

    const startToTrayKey = isMac ? "startToMenuBar" : "startToTray";
    this.startToTrayText = this.i18nService.t(startToTrayKey);
    this.startToTrayDescText = this.i18nService.t(startToTrayKey + "Desc");

    // DuckDuckGo browser is only for macos initially
    this.showDuckDuckGoIntegrationOption = flagEnabled("showDDGSetting") && isMac;

    this.vaultTimeoutOptions = [
      // { name: i18nService.t('immediately'), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
      { name: this.i18nService.t("onIdle"), value: -4 },
      { name: this.i18nService.t("onSleep"), value: -3 },
    ];

    if (this.platformUtilsService.getDevice() !== DeviceType.LinuxDesktop) {
      this.vaultTimeoutOptions.push({ name: this.i18nService.t("onLocked"), value: -2 });
    }

    this.vaultTimeoutOptions = this.vaultTimeoutOptions.concat([
      { name: this.i18nService.t("onRestart"), value: -1 },
      { name: this.i18nService.t("never"), value: null },
    ]);

    const localeOptions: any[] = [];
    this.i18nService.supportedTranslationLocales.forEach((locale) => {
      let name = locale;
      if (this.i18nService.localeNames.has(locale)) {
        name += " - " + this.i18nService.localeNames.get(locale);
      }
      localeOptions.push({ name: name, value: locale });
    });
    localeOptions.sort(Utils.getSortFunction(this.i18nService, "name"));
    localeOptions.splice(0, 0, { name: this.i18nService.t("default"), value: null });
    this.localeOptions = localeOptions;

    this.themeOptions = [
      { name: this.i18nService.t("default"), value: ThemeType.System },
      { name: this.i18nService.t("light"), value: ThemeType.Light },
      { name: this.i18nService.t("dark"), value: ThemeType.Dark },
      { name: "Nord", value: ThemeType.Nord },
    ];

    this.clearClipboardOptions = [
      { name: this.i18nService.t("never"), value: null },
      { name: this.i18nService.t("tenSeconds"), value: 10 },
      { name: this.i18nService.t("twentySeconds"), value: 20 },
      { name: this.i18nService.t("thirtySeconds"), value: 30 },
      { name: this.i18nService.t("oneMinute"), value: 60 },
      { name: this.i18nService.t("twoMinutes"), value: 120 },
      { name: this.i18nService.t("fiveMinutes"), value: 300 },
    ];
  }

  async ngOnInit() {
    this.userHasMasterPassword = await this.userVerificationService.hasMasterPassword();

    this.isWindows = (await this.platformUtilsService.getDevice()) === DeviceType.WindowsDesktop;

    if ((await this.stateService.getUserId()) == null) {
      return;
    }
    this.currentUserEmail = await this.stateService.getEmail();

    this.availableVaultTimeoutActions$ = this.refreshTimeoutSettings$.pipe(
      switchMap(() => this.vaultTimeoutSettingsService.availableVaultTimeoutActions$()),
    );

    // Load timeout policy
    this.vaultTimeoutPolicyCallout = this.policyService.get$(PolicyType.MaximumVaultTimeout).pipe(
      filter((policy) => policy != null),
      map((policy) => {
        let timeout;
        if (policy.data?.minutes) {
          timeout = {
            hours: Math.floor(policy.data?.minutes / 60),
            minutes: policy.data?.minutes % 60,
          };
        }
        return { timeout: timeout, action: policy.data?.action };
      }),
      tap((policy) => {
        if (policy.action) {
          this.form.controls.vaultTimeoutAction.disable({ emitEvent: false });
        } else {
          this.form.controls.vaultTimeoutAction.enable({ emitEvent: false });
        }
      }),
    );

    // Load initial values
    const pinStatus = await this.vaultTimeoutSettingsService.isPinLockSet();
    this.userHasPinSet = pinStatus !== "DISABLED";

    const initialValues = {
      vaultTimeout: await this.vaultTimeoutSettingsService.getVaultTimeout(),
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.vaultTimeoutAction$(),
      ),
      pin: this.userHasPinSet,
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(),
      autoPromptBiometrics: await firstValueFrom(this.biometricStateService.promptAutomatically$),
      requirePasswordOnStart: await firstValueFrom(
        this.biometricStateService.requirePasswordOnStart$,
      ),
      approveLoginRequests: (await this.stateService.getApproveLoginRequests()) ?? false,
      clearClipboard: await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$),
      minimizeOnCopyToClipboard: await this.stateService.getMinimizeOnCopyToClipboard(),
      enableFavicons: !(await this.stateService.getDisableFavicon()),
      enableTray: await this.stateService.getEnableTray(),
      enableMinToTray: await this.stateService.getEnableMinimizeToTray(),
      enableCloseToTray: await this.stateService.getEnableCloseToTray(),
      startToTray: await this.stateService.getEnableStartToTray(),
      openAtLogin: await this.stateService.getOpenAtLogin(),
      alwaysShowDock: await this.stateService.getAlwaysShowDock(),
      enableBrowserIntegration: await this.stateService.getEnableBrowserIntegration(),
      enableBrowserIntegrationFingerprint:
        await this.stateService.getEnableBrowserIntegrationFingerprint(),
      enableDuckDuckGoBrowserIntegration:
        await this.stateService.getEnableDuckDuckGoBrowserIntegration(),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      locale: await firstValueFrom(this.i18nService.userSetLocale$),
    };
    this.form.setValue(initialValues, { emitEvent: false });

    if (this.form.value.enableBrowserIntegration) {
      this.form.controls.enableBrowserIntegrationFingerprint.enable();
    }

    // Non-form values
    this.showMinToTray = this.platformUtilsService.getDevice() !== DeviceType.LinuxDesktop;
    this.showAlwaysShowDock = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
    this.supportsBiometric = await this.platformUtilsService.supportsBiometric();
    this.additionalBiometricSettingsText =
      this.biometricText === "unlockWithTouchId"
        ? "additionalTouchIdSettings"
        : "additionalWindowsHelloSettings";
    this.previousVaultTimeout = this.form.value.vaultTimeout;

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() => this.vaultTimeoutSettingsService.vaultTimeoutAction$()),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        this.form.controls.vaultTimeoutAction.setValue(action, { emitEvent: false });
      });

    // Form events
    this.form.controls.vaultTimeout.valueChanges
      .pipe(
        debounceTime(500),
        concatMap(async (value) => {
          await this.saveVaultTimeout(value);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.vaultTimeoutAction.valueChanges
      .pipe(
        concatMap(async (action) => {
          await this.saveVaultTimeoutAction(action);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.pin.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updatePin(value);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateBiometric(enabled);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.enableBrowserIntegration.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((enabled) => {
        if (enabled) {
          this.form.controls.enableBrowserIntegrationFingerprint.enable();
        } else {
          this.form.controls.enableBrowserIntegrationFingerprint.disable();
        }
      });
  }

  async saveVaultTimeout(newValue: number) {
    if (newValue == null) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeout.setValue(this.previousVaultTimeout);
        return;
      }
    }

    // Avoid saving 0 since it's useless as a timeout value.
    if (this.form.value.vaultTimeout === 0) {
      return;
    }

    if (!this.form.controls.vaultTimeout.valid) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutTooLarge"),
      );
      return;
    }

    this.previousVaultTimeout = this.form.value.vaultTimeout;

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      newValue,
      this.form.value.vaultTimeoutAction,
    );
  }

  async saveVaultTimeoutAction(newValue: VaultTimeoutAction) {
    if (newValue === "logOut") {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeoutAction.patchValue(VaultTimeoutAction.Lock, {
          emitEvent: false,
        });
        return;
      }
    }

    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutTooLarge"),
      );
      return;
    }

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      this.form.value.vaultTimeout,
      newValue,
    );
  }

  async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      this.userHasPinSet = await firstValueFrom(dialogRef.closed);
      this.form.controls.pin.setValue(this.userHasPinSet, { emitEvent: false });
    }

    if (!value) {
      // If user turned off PIN without having a MP and has biometric + require MP/PIN on restart enabled
      if (this.form.value.requirePasswordOnStart && !this.userHasMasterPassword) {
        // then must turn that off to prevent user from getting into bad state
        this.form.controls.requirePasswordOnStart.setValue(false);
        await this.updateRequirePasswordOnStart();
      }

      await this.vaultTimeoutSettingsService.clear();
    }

    this.messagingService.send("redrawMenu");
  }

  async updateBiometric(enabled: boolean) {
    // NOTE: A bug in angular causes [ngModel] to not reflect the backing field value
    // causing the checkbox to remain checked even if authentication fails.
    // The bug should resolve itself once the angular issue is resolved.
    // See: https://github.com/angular/angular/issues/13063

    try {
      if (!enabled || !this.supportsBiometric) {
        this.form.controls.biometric.setValue(false, { emitEvent: false });
        await this.biometricStateService.setBiometricUnlockEnabled(false);
        await this.cryptoService.refreshAdditionalKeys();
        return;
      }

      await this.biometricStateService.setBiometricUnlockEnabled(true);
      if (this.isWindows) {
        // Recommended settings for Windows Hello
        this.form.controls.requirePasswordOnStart.setValue(true);
        this.form.controls.autoPromptBiometrics.setValue(false);
        await this.biometricStateService.setPromptAutomatically(false);
        await this.biometricStateService.setRequirePasswordOnStart(true);
        await this.biometricStateService.setDismissedRequirePasswordOnStartCallout();
      }
      await this.cryptoService.refreshAdditionalKeys();

      // Validate the key is stored in case biometrics fail.
      const biometricSet = await this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric);
      this.form.controls.biometric.setValue(biometricSet, { emitEvent: false });
      if (!biometricSet) {
        await this.biometricStateService.setBiometricUnlockEnabled(false);
      }
    } finally {
      this.messagingService.send("redrawMenu");
    }
  }

  async updateAutoPromptBiometrics() {
    if (this.form.value.autoPromptBiometrics) {
      // require password on start must be disabled if auto prompt biometrics is enabled
      this.form.controls.requirePasswordOnStart.setValue(false);
      await this.updateRequirePasswordOnStart();
      await this.biometricStateService.setPromptAutomatically(true);
    } else {
      await this.biometricStateService.setPromptAutomatically(false);
    }
  }

  async updateRequirePasswordOnStart() {
    if (this.form.value.requirePasswordOnStart) {
      // auto prompt biometrics must be disabled if require password on start is enabled
      this.form.controls.autoPromptBiometrics.setValue(false);
      await this.updateAutoPromptBiometrics();

      await this.biometricStateService.setRequirePasswordOnStart(true);
    } else {
      await this.biometricStateService.setRequirePasswordOnStart(false);
    }
    await this.biometricStateService.setDismissedRequirePasswordOnStartCallout();
    await this.cryptoService.refreshAdditionalKeys();
  }

  async saveFavicons() {
    await this.settingsService.setDisableFavicon(!this.form.value.enableFavicons);
    this.messagingService.send("refreshCiphers");
  }

  async saveMinToTray() {
    await this.stateService.setEnableMinimizeToTray(this.form.value.enableMinToTray);
  }

  async saveCloseToTray() {
    if (this.requireEnableTray) {
      this.form.controls.enableTray.setValue(true);
      await this.stateService.setEnableTray(this.form.value.enableTray);
    }

    await this.stateService.setEnableCloseToTray(this.form.value.enableCloseToTray);
  }

  async saveTray() {
    if (
      this.requireEnableTray &&
      !this.form.value.enableTray &&
      (this.form.value.startToTray || this.form.value.enableCloseToTray)
    ) {
      const confirm = await this.dialogService.openSimpleDialog({
        title: { key: "confirmTrayTitle" },
        content: { key: "confirmTrayDesc" },
        type: "warning",
      });

      if (confirm) {
        this.form.controls.startToTray.setValue(false, { emitEvent: false });
        await this.stateService.setEnableStartToTray(this.form.value.startToTray);
        this.form.controls.enableCloseToTray.setValue(false, { emitEvent: false });
        await this.stateService.setEnableCloseToTray(this.form.value.enableCloseToTray);
      } else {
        this.form.controls.enableTray.setValue(true);
      }

      return;
    }

    await this.stateService.setEnableTray(this.form.value.enableTray);
    this.messagingService.send(this.form.value.enableTray ? "showTray" : "removeTray");
  }

  async saveStartToTray() {
    if (this.requireEnableTray) {
      this.form.controls.enableTray.setValue(true);
      await this.stateService.setEnableTray(this.form.value.enableTray);
    }

    await this.stateService.setEnableStartToTray(this.form.value.startToTray);
  }

  async saveLocale() {
    await this.i18nService.setLocale(this.form.value.locale);
  }

  async saveTheme() {
    await this.themeStateService.setSelectedTheme(this.form.value.theme);
  }

  async saveMinOnCopyToClipboard() {
    await this.stateService.setMinimizeOnCopyToClipboard(this.form.value.minimizeOnCopyToClipboard);
  }

  async saveClearClipboard() {
    await this.autofillSettingsService.setClearClipboardDelay(this.form.value.clearClipboard);
  }

  async saveAlwaysShowDock() {
    await this.stateService.setAlwaysShowDock(this.form.value.alwaysShowDock);
  }

  async saveOpenAtLogin() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.stateService.setOpenAtLogin(this.form.value.openAtLogin);
    this.messagingService.send(
      this.form.value.openAtLogin ? "addOpenAtLogin" : "removeOpenAtLogin",
    );
  }

  async saveBrowserIntegration() {
    if (
      ipc.platform.deviceType === DeviceType.MacOsDesktop &&
      !this.platformUtilsService.isMacAppStore()
    ) {
      await this.dialogService.openSimpleDialog({
        title: { key: "browserIntegrationUnsupportedTitle" },
        content: { key: "browserIntegrationMasOnlyDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

      this.form.controls.enableBrowserIntegration.setValue(false);
      return;
    } else if (ipc.platform.isWindowsStore) {
      await this.dialogService.openSimpleDialog({
        title: { key: "browserIntegrationUnsupportedTitle" },
        content: { key: "browserIntegrationWindowsStoreDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

      this.form.controls.enableBrowserIntegration.setValue(false);
      return;
    } else if (ipc.platform.deviceType === DeviceType.LinuxDesktop) {
      await this.dialogService.openSimpleDialog({
        title: { key: "browserIntegrationUnsupportedTitle" },
        content: { key: "browserIntegrationLinuxDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

      this.form.controls.enableBrowserIntegration.setValue(false);
      return;
    }

    await this.stateService.setEnableBrowserIntegration(this.form.value.enableBrowserIntegration);
    this.messagingService.send(
      this.form.value.enableBrowserIntegration
        ? "enableBrowserIntegration"
        : "disableBrowserIntegration",
    );

    if (!this.form.value.enableBrowserIntegration) {
      this.form.controls.enableBrowserIntegrationFingerprint.setValue(false);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.saveBrowserIntegrationFingerprint();
    }
  }

  async saveDdgBrowserIntegration() {
    await this.stateService.setEnableDuckDuckGoBrowserIntegration(
      this.form.value.enableDuckDuckGoBrowserIntegration,
    );

    if (!this.form.value.enableBrowserIntegration) {
      await this.stateService.setDuckDuckGoSharedKey(null);
    }

    this.messagingService.send(
      this.form.value.enableDuckDuckGoBrowserIntegration
        ? "enableDuckDuckGoBrowserIntegration"
        : "disableDuckDuckGoBrowserIntegration",
    );
  }

  async saveBrowserIntegrationFingerprint() {
    await this.stateService.setEnableBrowserIntegrationFingerprint(
      this.form.value.enableBrowserIntegrationFingerprint,
    );
  }

  async updateApproveLoginRequests() {
    await this.stateService.setApproveLoginRequests(this.form.value.approveLoginRequests);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get biometricText() {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "unlockWithTouchId";
      case DeviceType.WindowsDesktop:
        return "unlockWithWindowsHello";
      default:
        throw new Error("Unsupported platform");
    }
  }

  get autoPromptBiometricsText() {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "autoPromptTouchId";
      case DeviceType.WindowsDesktop:
        return "autoPromptWindowsHello";
      default:
        throw new Error("Unsupported platform");
    }
  }
}
