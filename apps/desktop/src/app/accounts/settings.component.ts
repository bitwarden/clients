// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { BehaviorSubject, Observable, Subject, combineLatest, firstValueFrom, of } from "rxjs";
import { concatMap, map, pairwise, startWith, switchMap, takeUntil, timeout } from "rxjs/operators";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutOption,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
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
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService, BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";
import {
  SessionTimeoutInputComponent,
  SessionTimeoutSettingsComponent,
} from "@bitwarden/key-management-ui";
import { PermitCipherDetailsPopoverComponent } from "@bitwarden/vault";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { AutotypeShortcutComponent } from "../../autofill/components/autotype-shortcut.component";
import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { DesktopPremiumUpgradePromptService } from "../../services/desktop-premium-upgrade-prompt.service";
import { NativeMessagingManifestService } from "../services/native-messaging-manifest.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-settings",
  templateUrl: "settings.component.html",
  standalone: true,
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  imports: [
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    ItemModule,
    JslibModule,
    LinkModule,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
    SessionTimeoutInputComponent,
    SessionTimeoutSettingsComponent,
    PermitCipherDetailsPopoverComponent,
    PremiumBadgeComponent,
  ],
})
export class SettingsComponent implements OnInit, OnDestroy {
  // For use in template
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  showMinToTray = false;
  localeOptions: any[];
  themeOptions: any[];
  clearClipboardOptions: any[];
  sshAgentPromptBehaviorOptions: any[];
  supportsBiometric: boolean;
  private timerId: any;
  showAlwaysShowDock = false;
  requireEnableTray = false;
  showDuckDuckGoIntegrationOption = false;
  showEnableAutotype = false;
  autotypeShortcut: string;
  showOpenAtLoginOption = false;
  isWindows: boolean;
  isLinux: boolean;
  isMac: boolean;

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
  currentUserId: UserId;

  availableVaultTimeoutActions: VaultTimeoutAction[] = [];
  vaultTimeoutOptions: VaultTimeoutOption[] = [];
  hasVaultTimeoutPolicy = false;

  userHasMasterPassword: boolean;
  userHasPinSet: boolean;

  pinEnabled$: Observable<boolean> = of(true);
  isWindowsV2BiometricsEnabled: boolean = false;

  consolidatedSessionTimeoutComponent$: Observable<boolean>;

  form = this.formBuilder.group({
    // Security
    vaultTimeout: [null as VaultTimeout | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
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
    startToTray: false,
    openAtLogin: false,
    alwaysShowDock: false,
    enableBrowserIntegration: false,
    enableBrowserIntegrationFingerprint: this.formBuilder.control<boolean>({
      value: false,
      disabled: true,
    }),
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

  protected refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private stateService: StateService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private messagingService: MessagingService,
    private keyService: KeyService,
    private themeStateService: ThemeStateService,
    private domainSettingsService: DomainSettingsService,
    private dialogService: DialogService,
    private userVerificationService: UserVerificationServiceAbstraction,
    private desktopSettingsService: DesktopSettingsService,
    private desktopAutotypeService: DesktopAutotypeService,
    private biometricStateService: BiometricStateService,
    private biometricsService: DesktopBiometricsService,
    private desktopAutofillSettingsService: DesktopAutofillSettingsService,
    private pinService: PinServiceAbstraction,
    private logService: LogService,
    private nativeMessagingManifestService: NativeMessagingManifestService,
    private configService: ConfigService,
    private validationService: ValidationService,
    private changeDetectorRef: ChangeDetectorRef,
    private toastService: ToastService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.isMac = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
    this.isLinux = this.platformUtilsService.getDevice() === DeviceType.LinuxDesktop;
    this.isWindows = this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;

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

    const startToTrayKey = this.isMac ? "startToMenuBar" : "startToTray";
    this.startToTrayText = this.i18nService.t(startToTrayKey);
    this.startToTrayDescText = this.i18nService.t(startToTrayKey + "Desc");

    this.showOpenAtLoginOption = !ipc.platform.isWindowsStore;

    // DuckDuckGo browser is only for macos initially
    this.showDuckDuckGoIntegrationOption = this.isMac;

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
      { name: this.i18nService.t("default"), value: ThemeTypes.System },
      { name: this.i18nService.t("light"), value: ThemeTypes.Light },
      { name: this.i18nService.t("dark"), value: ThemeTypes.Dark },
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
    this.sshAgentPromptBehaviorOptions = [
      {
        name: this.i18nService.t("sshAgentPromptBehaviorAlways"),
        value: SshAgentPromptType.Always,
      },
      { name: this.i18nService.t("sshAgentPromptBehaviorNever"), value: SshAgentPromptType.Never },
      {
        name: this.i18nService.t("sshAgentPromptBehaviorRememberUntilLock"),
        value: SshAgentPromptType.RememberUntilLock,
      },
    ];

    this.consolidatedSessionTimeoutComponent$ = this.configService.getFeatureFlag$(
      FeatureFlag.ConsolidatedSessionTimeoutComponent,
    );
  }

  async ngOnInit() {
    this.vaultTimeoutOptions = await this.generateVaultTimeoutOptions();

    this.isWindowsV2BiometricsEnabled = await this.biometricsService.isWindowsV2BiometricsEnabled();

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    // Autotype is for Windows initially
    const isWindows = this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;
    if (isWindows) {
      this.configService
        .getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype)
        .pipe(takeUntil(this.destroy$))
        .subscribe((enabled) => {
          this.showEnableAutotype = enabled;
        });
    }

    this.userHasMasterPassword = await this.userVerificationService.hasMasterPassword();

    this.currentUserEmail = activeAccount.email;
    this.currentUserId = activeAccount.id;

    const maximumVaultTimeoutPolicy = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
      ),
      getFirstPolicy,
    );
    if ((await firstValueFrom(maximumVaultTimeoutPolicy)) != null) {
      this.hasVaultTimeoutPolicy = true;
    }

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
            this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(([availableActions, action]) => {
        this.availableVaultTimeoutActions = availableActions;
        this.form.controls.vaultTimeoutAction.setValue(action, { emitEvent: false });
        // NOTE: The UI doesn't properly update without detect changes.
        // I've even tried using an async pipe, but it still doesn't work. I'm not sure why.
        // Using an async pipe means that we can't call `detectChanges` AFTER the data has change
        // meaning that we are forced to use regular class variables instead of observables.
        this.changeDetectorRef.detectChanges();
      });

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
            maximumVaultTimeoutPolicy,
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(([availableActions, policy]) => {
        if (policy?.data?.action || availableActions.length <= 1) {
          this.form.controls.vaultTimeoutAction.disable({ emitEvent: false });
        } else {
          this.form.controls.vaultTimeoutAction.enable({ emitEvent: false });
        }
      });

    // Load initial values
    this.userHasPinSet = await this.pinService.isPinSet(activeAccount.id);

    this.pinEnabled$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.RemoveUnlockWithPin, userId),
      ),
      getFirstPolicy,
      map((policy) => {
        return policy == null || !policy.enabled;
      }),
    );

    const initialValues = {
      vaultTimeout: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(activeAccount.id),
      ),
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
      ),
      pin: this.userHasPinSet,
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(),
      requireMasterPasswordOnAppRestart: !(await this.biometricsService.hasPersistentKey(
        activeAccount.id,
      )),
      autoPromptBiometrics: await firstValueFrom(this.biometricStateService.promptAutomatically$),
      clearClipboard: await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$),
      minimizeOnCopyToClipboard: await firstValueFrom(this.desktopSettingsService.minimizeOnCopy$),
      enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
      enableTray: await firstValueFrom(this.desktopSettingsService.trayEnabled$),
      enableMinToTray: await firstValueFrom(this.desktopSettingsService.minimizeToTray$),
      enableCloseToTray: await firstValueFrom(this.desktopSettingsService.closeToTray$),
      startToTray: await firstValueFrom(this.desktopSettingsService.startToTray$),
      openAtLogin: await firstValueFrom(this.desktopSettingsService.openAtLogin$),
      alwaysShowDock: await firstValueFrom(this.desktopSettingsService.alwaysShowDock$),
      enableBrowserIntegration: await firstValueFrom(
        this.desktopSettingsService.browserIntegrationEnabled$,
      ),
      enableBrowserIntegrationFingerprint: await firstValueFrom(
        this.desktopSettingsService.browserIntegrationFingerprintEnabled$,
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

    if (this.form.value.enableBrowserIntegration) {
      this.form.controls.enableBrowserIntegrationFingerprint.enable();
    }

    // Non-form values
    this.showMinToTray = this.platformUtilsService.getDevice() !== DeviceType.LinuxDesktop;
    this.showAlwaysShowDock = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() =>
          this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        this.form.controls.vaultTimeoutAction.setValue(action, { emitEvent: false });
      });

    if (isWindows) {
      this.billingAccountProfileStateService
        .hasPremiumFromAnySource$(activeAccount.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe((hasPremium) => {
          if (hasPremium) {
            this.form.controls.enableAutotype.enable();
          }
        });
    }

    // Form events
    this.form.controls.vaultTimeout.valueChanges
      .pipe(
        startWith(initialValues.vaultTimeout), // emit to init pairwise
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveVaultTimeout(previousValue, newValue);
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
          await this.updatePinHandler(value);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateBiometricHandler(enabled);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.requireMasterPasswordOnAppRestart.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updateRequireMasterPasswordOnAppRestartHandler(value, activeAccount.id);
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

    this.supportsBiometric = await this.biometricsService.canEnableBiometricUnlock();
    this.timerId = setInterval(async () => {
      this.supportsBiometric = await this.biometricsService.canEnableBiometricUnlock();
    }, 1000);
  }

  async saveVaultTimeout(previousValue: VaultTimeout, newValue: VaultTimeout) {
    if (newValue === VaultTimeoutStringType.Never) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeout.setValue(previousValue, { emitEvent: false });
        return;
      }
    }

    // Avoid saving 0 since it's useless as a timeout value.
    if (newValue === 0) {
      return;
    }

    if (!this.form.controls.vaultTimeout.valid) {
      return;
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAccount.id,
      newValue,
      this.form.getRawValue().vaultTimeoutAction,
    );
    this.refreshTimeoutSettings$.next();
  }

  async saveVaultTimeoutAction(value: VaultTimeoutAction) {
    if (value === VaultTimeoutAction.LogOut) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeoutAction.setValue(VaultTimeoutAction.Lock, {
          emitEvent: false,
        });
        return;
      }
    }

    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("vaultTimeoutTooLarge"),
      });
      return;
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAccount.id,
      this.form.value.vaultTimeout,
      value,
    );
    this.refreshTimeoutSettings$.next();
  }

  async updatePinHandler(value: boolean) {
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

  async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      this.userHasPinSet = await firstValueFrom(dialogRef.closed);
      this.form.controls.pin.setValue(this.userHasPinSet, { emitEvent: false });
    } else {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      // On Windows if a user turned off PIN without having a MP and has biometrics + require MP/PIN on restart enabled.
      if (
        this.isWindows &&
        this.isWindowsV2BiometricsEnabled &&
        this.supportsBiometric &&
        this.form.value.requireMasterPasswordOnAppRestart &&
        this.form.value.biometric &&
        !this.userHasMasterPassword
      ) {
        // Allow biometric unlock on app restart so the user doesn't get into a bad state.
        await this.enrollPersistentBiometricIfNeeded(userId);
      }
      await this.pinService.unsetPin(userId);
    }
  }

  async updateBiometricHandler(value: boolean) {
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

  async updateBiometric(enabled: boolean) {
    // NOTE: A bug in angular causes [ngModel] to not reflect the backing field value
    // causing the checkbox to remain checked even if authentication fails.
    // The bug should resolve itself once the angular issue is resolved.
    // See: https://github.com/angular/angular/issues/13063

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (!enabled || !this.supportsBiometric) {
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

      if (this.isWindowsV2BiometricsEnabled) {
        // If the user doesn't have a MP or PIN then they have to use biometrics on app restart.
        if (!this.userHasMasterPassword && !this.userHasPinSet) {
          // Allow biometric unlock on app restart so the user doesn't get into a bad state.
          await this.enrollPersistentBiometricIfNeeded(activeUserId);
        } else {
          this.form.controls.requireMasterPasswordOnAppRestart.setValue(true);
        }
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

  async updateRequireMasterPasswordOnAppRestartHandler(enabled: boolean, userId: UserId) {
    try {
      await this.updateRequireMasterPasswordOnAppRestart(enabled, userId);
    } catch (error) {
      this.logService.error("Error updating require master password on app restart: ", error);
      this.validationService.showError(error);
    }
  }

  async updateRequireMasterPasswordOnAppRestart(enabled: boolean, userId: UserId) {
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

  async updateAutoPromptBiometrics() {
    if (this.form.value.autoPromptBiometrics) {
      await this.biometricStateService.setPromptAutomatically(true);
    } else {
      await this.biometricStateService.setPromptAutomatically(false);
    }
  }

  async saveFavicons() {
    await this.domainSettingsService.setShowFavicons(this.form.value.enableFavicons);
    this.messagingService.send("refreshCiphers");
  }

  async saveMinToTray() {
    await this.desktopSettingsService.setMinimizeToTray(this.form.value.enableMinToTray);
  }

  async saveCloseToTray() {
    if (this.requireEnableTray) {
      this.form.controls.enableTray.setValue(true);
      await this.desktopSettingsService.setTrayEnabled(this.form.value.enableTray);
    }

    await this.desktopSettingsService.setCloseToTray(this.form.value.enableCloseToTray);
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
        await this.desktopSettingsService.setStartToTray(this.form.value.startToTray);
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

  async saveStartToTray() {
    if (this.requireEnableTray) {
      this.form.controls.enableTray.setValue(true);
      await this.desktopSettingsService.setTrayEnabled(this.form.value.enableTray);
    }

    await this.desktopSettingsService.setStartToTray(this.form.value.startToTray);
  }

  async saveLocale() {
    await this.i18nService.setLocale(this.form.value.locale);
  }

  async saveTheme() {
    await this.themeStateService.setSelectedTheme(this.form.value.theme);
  }

  async saveMinOnCopyToClipboard() {
    await this.desktopSettingsService.setMinimizeOnCopy(
      this.form.value.minimizeOnCopyToClipboard,
      this.currentUserId,
    );
  }

  async saveClearClipboard() {
    await this.autofillSettingsService.setClearClipboardDelay(this.form.value.clearClipboard);
  }

  async saveAlwaysShowDock() {
    await this.desktopSettingsService.setAlwaysShowDock(this.form.value.alwaysShowDock);
  }

  async saveOpenAtLogin() {
    await this.desktopSettingsService.setOpenAtLogin(this.form.value.openAtLogin);
    // TODO: Ideally DesktopSettingsService.openAtLogin$ could be subscribed to directly rather than sending a message
    this.messagingService.send(
      this.form.value.openAtLogin ? "addOpenAtLogin" : "removeOpenAtLogin",
    );
  }

  async saveBrowserIntegration() {
    const skipSupportedPlatformCheck =
      ipc.platform.allowBrowserintegrationOverride || ipc.platform.isDev;

    if (!skipSupportedPlatformCheck) {
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
      }

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

      if (ipc.platform.isSnapStore || ipc.platform.isFlatpak) {
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

    if (!this.form.value.enableBrowserIntegration) {
      this.form.controls.enableBrowserIntegrationFingerprint.setValue(false);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.saveBrowserIntegrationFingerprint();
    }
  }

  async saveDdgBrowserIntegration() {
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

  async saveBrowserIntegrationFingerprint() {
    await this.desktopSettingsService.setBrowserIntegrationFingerprintEnabled(
      this.form.value.enableBrowserIntegrationFingerprint,
    );
  }

  async saveHardwareAcceleration() {
    await this.desktopSettingsService.setHardwareAcceleration(
      this.form.value.enableHardwareAcceleration,
    );
  }

  async saveSshAgent() {
    await this.desktopSettingsService.setSshAgentEnabled(this.form.value.enableSshAgent);
  }

  async saveSshAgentPromptBehavior() {
    await this.desktopSettingsService.setSshAgentPromptBehavior(
      this.form.value.sshAgentPromptBehavior,
    );
  }

  async savePreventScreenshots() {
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
        dialogRef.close();
      }

      if (!enabled) {
        await this.desktopSettingsService.setPreventScreenshots(false);
        this.form.controls.allowScreenshots.setValue(true, { emitEvent: false });
      }
    }
  }

  async saveEnableAutotype() {
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

  async saveAutotypeShortcut() {
    const dialogRef = AutotypeShortcutComponent.open(this.dialogService);

    const newShortcutArray = await firstValueFrom(dialogRef.closed);

    if (!newShortcutArray) {
      return;
    }

    this.form.controls.autotypeShortcut.setValue(
      this.getFormattedAutotypeShortcutText(newShortcutArray),
    );
    await this.desktopAutotypeService.setAutotypeKeyboardShortcutState(newShortcutArray);
  }

  private async generateVaultTimeoutOptions(): Promise<VaultTimeoutOption[]> {
    let vaultTimeoutOptions: VaultTimeoutOption[] = [
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
      { name: this.i18nService.t("onIdle"), value: VaultTimeoutStringType.OnIdle },
      { name: this.i18nService.t("onSleep"), value: VaultTimeoutStringType.OnSleep },
    ];

    if (await ipc.platform.powermonitor.isLockMonitorAvailable()) {
      vaultTimeoutOptions.push({
        name: this.i18nService.t("onLocked"),
        value: VaultTimeoutStringType.OnLocked,
      });
    }

    vaultTimeoutOptions = vaultTimeoutOptions.concat([
      { name: this.i18nService.t("onRestart"), value: VaultTimeoutStringType.OnRestart },
      { name: this.i18nService.t("never"), value: VaultTimeoutStringType.Never },
    ]);

    return vaultTimeoutOptions;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.timerId);
  }

  get biometricText() {
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

  getFormattedAutotypeShortcutText(shortcut: string[]) {
    return shortcut ? shortcut.join("+").replace("Super", "Win") : null;
  }
}
