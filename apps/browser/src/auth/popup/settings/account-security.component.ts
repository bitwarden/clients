// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  pairwise,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  timer,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutOption,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DialogRef,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
  ToastService,
} from "@bitwarden/components";
import {
  KeyService,
  BiometricsService,
  BiometricStateService,
  BiometricsStatus,
} from "@bitwarden/key-management";
import {
  SessionTimeoutInputComponent,
  SessionTimeoutSettingsComponent,
} from "@bitwarden/key-management-ui";

import { BiometricErrors, BiometricErrorTypes } from "../../../models/biometricErrors";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { SetPinComponent } from "../components/set-pin.component";

import { AwaitDesktopDialogComponent } from "./await-desktop-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "account-security.component.html",
  imports: [
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    ItemModule,
    JslibModule,
    LinkModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SessionTimeoutSettingsComponent,
    SpotlightComponent,
    TypographyModule,
    SessionTimeoutInputComponent,
  ],
})
export class AccountSecurityComponent implements OnInit, OnDestroy {
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  showMasterPasswordOnClientRestartOption = true;
  availableVaultTimeoutActions: VaultTimeoutAction[] = [];
  vaultTimeoutOptions: VaultTimeoutOption[] = [];
  hasVaultTimeoutPolicy = false;
  biometricUnavailabilityReason: string;
  showChangeMasterPass = true;
  pinEnabled$: Observable<boolean> = of(true);

  form = this.formBuilder.group({
    vaultTimeout: [null as VaultTimeout | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    pin: [null as boolean | null],
    pinLockWithMasterPassword: false,
    biometric: false,
    enableAutoBiometricsPrompt: true,
  });

  protected showAccountSecurityNudge$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.vaultNudgesService.showNudgeSpotlight$(NudgeType.AccountSecurity, userId),
      ),
    );

  protected readonly consolidatedSessionTimeoutComponent$: Observable<boolean>;

  protected refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private configService: ConfigService,
    private pinService: PinServiceAbstraction,
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    public messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private keyService: KeyService,
    private userVerificationService: UserVerificationService,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private biometricStateService: BiometricStateService,
    private toastService: ToastService,
    private biometricsService: BiometricsService,
    private vaultNudgesService: NudgesService,
    private validationService: ValidationService,
    private logService: LogService,
  ) {
    this.consolidatedSessionTimeoutComponent$ = this.configService.getFeatureFlag$(
      FeatureFlag.ConsolidatedSessionTimeoutComponent,
    );
  }

  async ngOnInit() {
    const hasMasterPassword = await this.userVerificationService.hasMasterPassword();
    this.showMasterPasswordOnClientRestartOption = hasMasterPassword;
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

    // Determine platform-specific timeout options
    const showOnLocked =
      !this.platformUtilsService.isFirefox() &&
      !this.platformUtilsService.isSafari() &&
      !(this.platformUtilsService.isOpera() && navigator.platform === "MacIntel");

    this.vaultTimeoutOptions = [
      { name: this.i18nService.t("immediately"), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
    ];

    if (showOnLocked) {
      this.vaultTimeoutOptions.push({
        name: this.i18nService.t("onLocked"),
        value: VaultTimeoutStringType.OnLocked,
      });
    }

    this.vaultTimeoutOptions.push({
      name: this.i18nService.t("onRestart"),
      value: VaultTimeoutStringType.OnRestart,
    });
    this.vaultTimeoutOptions.push({
      name: this.i18nService.t("never"),
      value: VaultTimeoutStringType.Never,
    });

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    let timeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(activeAccount.id),
    );
    if (timeout === VaultTimeoutStringType.OnLocked && !showOnLocked) {
      timeout = VaultTimeoutStringType.OnRestart;
    }

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
      vaultTimeout: timeout,
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
      ),
      pin: await this.pinService.isPinSet(activeAccount.id),
      pinLockWithMasterPassword:
        (await this.pinService.getPinLockType(activeAccount.id)) == "EPHEMERAL",
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(),
      enableAutoBiometricsPrompt: await firstValueFrom(
        this.biometricStateService.promptAutomatically$,
      ),
    };
    this.form.patchValue(initialValues, { emitEvent: false });

    timer(0, 1000)
      .pipe(
        switchMap(async () => {
          const status = await this.biometricsService.getBiometricsStatusForUser(activeAccount.id);
          const biometricSettingAvailable = await this.biometricsService.canEnableBiometricUnlock();
          if (!biometricSettingAvailable) {
            this.form.controls.biometric.disable({ emitEvent: false });
          } else {
            this.form.controls.biometric.enable({ emitEvent: false });
          }

          if (status === BiometricsStatus.DesktopDisconnected && !biometricSettingAvailable) {
            this.biometricUnavailabilityReason = this.i18nService.t(
              "biometricsStatusHelptextDesktopDisconnected",
            );
          } else if (
            status === BiometricsStatus.NotEnabledInConnectedDesktopApp &&
            !biometricSettingAvailable
          ) {
            this.biometricUnavailabilityReason = this.i18nService.t(
              "biometricsStatusHelptextNotEnabledInDesktop",
              activeAccount.email,
            );
          } else if (
            status === BiometricsStatus.HardwareUnavailable &&
            !biometricSettingAvailable
          ) {
            this.biometricUnavailabilityReason = this.i18nService.t(
              "biometricsStatusHelptextHardwareUnavailable",
            );
          } else {
            this.biometricUnavailabilityReason = "";
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.showChangeMasterPass = await this.userVerificationService.hasMasterPassword();

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
        map(async (value) => {
          await this.saveVaultTimeoutAction(value);
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

    this.form.controls.pinLockWithMasterPassword.valueChanges
      .pipe(
        concatMap(async (value) => {
          const userId = (await firstValueFrom(this.accountService.activeAccount$)).id;
          const pin = await this.pinService.getPin(userId);
          await this.pinService.setPin(pin, value ? "EPHEMERAL" : "PERSISTENT", userId);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        distinctUntilChanged(),
        concatMap(async (enabled) => {
          await this.updateBiometric(enabled);
          if (enabled) {
            this.form.controls.enableAutoBiometricsPrompt.enable();
          } else {
            this.form.controls.enableAutoBiometricsPrompt.disable();
          }
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.enableAutoBiometricsPrompt.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.biometricStateService.setPromptAutomatically(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

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

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
    );

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAccount.id,
      newValue,
      vaultTimeoutAction,
    );
    if (newValue === VaultTimeoutStringType.Never) {
      this.messagingService.send("bgReseedStorage");
    }
  }

  protected async dismissAccountSecurityNudge() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      return;
    }
    await this.vaultNudgesService.dismissNudge(NudgeType.AccountSecurity, activeAccount.id);
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

  async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((account) => account.id)),
      );
      const userHasPinSet = await firstValueFrom(dialogRef.closed);
      this.form.controls.pin.setValue(userHasPinSet, { emitEvent: false });
      const requireReprompt = (await this.pinService.getPinLockType(userId)) == "EPHEMERAL";
      this.form.controls.pinLockWithMasterPassword.setValue(requireReprompt, { emitEvent: false });
      if (userHasPinSet) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("unlockPinSet"),
        });
        await this.vaultNudgesService.dismissNudge(NudgeType.AccountSecurity, userId);
      }
    } else {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.pinService.unsetPin(userId);
    }
  }

  async updateBiometric(enabled: boolean) {
    if (enabled) {
      let granted;
      try {
        granted = await BrowserApi.requestPermission({ permissions: ["nativeMessaging"] });
      } catch (e) {
        // eslint-disable-next-line
        console.error(e);

        if (this.platformUtilsService.isFirefox() && BrowserPopupUtils.inSidebar(window)) {
          await this.dialogService.openSimpleDialog({
            title: { key: "nativeMessaginPermissionSidebarTitle" },
            content: { key: "nativeMessaginPermissionSidebarDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "info",
          });

          this.form.controls.biometric.setValue(false);
          return;
        }
      }

      if (!granted) {
        await this.dialogService.openSimpleDialog({
          title: { key: "nativeMessaginPermissionErrorTitle" },
          content: { key: "nativeMessaginPermissionErrorDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        this.form.controls.biometric.setValue(false);
        return;
      }

      try {
        const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
        await this.keyService.refreshAdditionalKeys(userId);

        const successful = await this.trySetupBiometrics();
        this.form.controls.biometric.setValue(successful);
        await this.biometricStateService.setBiometricUnlockEnabled(successful);
        if (!successful) {
          await this.biometricStateService.setFingerprintValidated(false);
          return;
        }
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("unlockWithBiometricSet"),
        });
      } catch (error) {
        this.form.controls.biometric.setValue(false);
        this.validationService.showError(error);
      }
    } else {
      await this.biometricStateService.setBiometricUnlockEnabled(false);
      await this.biometricStateService.setFingerprintValidated(false);
    }
  }

  async trySetupBiometrics(): Promise<boolean> {
    let awaitDesktopDialogRef: DialogRef<boolean, unknown> | undefined;
    let biometricsResponseReceived = false;
    let setupResult = false;

    const waitForUserDialogPromise = async () => {
      // only show waiting dialog if we have waited for 500 msec to prevent double dialog
      // the os will respond instantly if the dialog shows successfully, and the desktop app will respond instantly if something is wrong
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (biometricsResponseReceived) {
        return;
      }

      awaitDesktopDialogRef = AwaitDesktopDialogComponent.open(this.dialogService);
      await firstValueFrom(awaitDesktopDialogRef.closed);
      if (!biometricsResponseReceived) {
        setupResult = false;
      }
      return;
    };

    const biometricsPromise = async () => {
      try {
        const userId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a.id)),
        );
        let result = false;
        try {
          const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
          result = await this.keyService.validateUserKey(userKey, userId);
          // FIXME: Remove when updating file. Eslint update
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          result = false;
        }

        // prevent duplicate dialog
        biometricsResponseReceived = true;
        if (awaitDesktopDialogRef) {
          awaitDesktopDialogRef.close(result);
        }

        if (!result) {
          this.platformUtilsService.showToast(
            "error",
            this.i18nService.t("errorEnableBiometricTitle"),
            this.i18nService.t("errorEnableBiometricDesc"),
          );
          setupResult = false;
          return;
        }
        setupResult = true;
      } catch (e) {
        // prevent duplicate dialog
        biometricsResponseReceived = true;
        if (awaitDesktopDialogRef) {
          awaitDesktopDialogRef.close(true);
        }

        if (e.message == "canceled") {
          setupResult = false;
          return;
        }

        const error = BiometricErrors[e.message as BiometricErrorTypes];
        const shouldRetry = await this.dialogService.openSimpleDialog({
          title: { key: error.title },
          content: { key: error.description },
          acceptButtonText: { key: "retry" },
          cancelButtonText: null,
          type: "danger",
        });
        if (shouldRetry) {
          setupResult = await this.trySetupBiometrics();
        } else {
          setupResult = false;
          return;
        }
      } finally {
        if (awaitDesktopDialogRef) {
          awaitDesktopDialogRef.close(true);
        }
      }
    };

    await Promise.all([waitForUserDialogPromise(), biometricsPromise()]);
    return setupResult;
  }

  async updateAutoBiometricsPrompt() {
    await this.biometricStateService.setPromptAutomatically(
      this.form.value.enableAutoBiometricsPrompt,
    );
  }

  async changePassword() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "changeMasterPasswordOnWebConfirmation" },
      type: "info",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      await BrowserApi.createNewTab(env.getWebVaultUrl());
    }
  }

  async twoStep() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "twoStepLoginConfirmationTitle" },
      content: { key: "twoStepLoginConfirmationContent" },
      type: "info",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
    if (confirmed) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("https://bitwarden.com/help/setup-two-step-login/");
    }
  }

  async openAcctFingerprintDialog() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const publicKey = await firstValueFrom(this.keyService.userPublicKey$(activeUserId));
    if (publicKey == null) {
      this.logService.error(
        "[AccountSecurityComponent] No public key available for the user: " +
          activeUserId +
          " fingerprint can't be displayed.",
      );
      return;
    }
    const fingerprint = await this.keyService.getFingerprint(activeUserId, publicKey);

    const dialogRef = FingerprintDialogComponent.open(this.dialogService, {
      fingerprint,
    });

    return firstValueFrom(dialogRef.closed);
  }

  async lock() {
    await this.vaultTimeoutService.lock();
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: "info",
    });

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (confirmed) {
      this.messagingService.send("logout", { userId: userId });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
