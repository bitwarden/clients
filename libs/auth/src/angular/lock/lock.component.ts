import { CommonModule } from "@angular/common";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, Subject, switchMap, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
} from "@bitwarden/common/auth/types/verification";
import { DeviceType } from "@bitwarden/common/enums";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/platform/sync";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

import { PinServiceAbstraction } from "../../common/abstractions";
import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";

import { LockComponentService } from "./lock-component.service";

// TODO: investigate this approach. It seems like a good way to handle the different unlock options.
// See user verification form input for example.
// type UnlockOptions = {
//   masterPassword: boolean;
//   pin: boolean;
//   biometrics: boolean;
// };

const BroadcasterSubscriptionId = "LockComponent";

@Component({
  selector: "bit-lock",
  templateUrl: "lock.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
  ],
})
export class LockV2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeAccount: { id: UserId | undefined } & AccountInfo;

  // TODO: is there a better way to do this?
  // unlockOpts: UnlockOptions = {
  //   masterPassword: false,
  //   pin: false,
  //   biometrics: false,
  // };

  pinEnabled = false;
  pin = "";
  private invalidPinAttempts = 0;

  supportsBiometric: boolean;
  biometricLock: boolean;

  // email: string;

  masterPasswordEnabled = false;
  masterPassword = "";
  showPassword = false;
  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions = undefined;

  // TODO: these should change by client.
  forcePasswordResetRoute = "update-temp-password";
  successRoute = "vault";

  formPromise: Promise<MasterPasswordVerificationResponse>;
  onSuccessfulSubmit: () => Promise<void>; // TODO: remove all callbacks

  webVaultHostname = "";

  // TODO: there will be more to do here.
  formGroup = this.formBuilder.group({
    masterPassword: ["", { validators: Validators.required, updateOn: "submit" }],
  });

  // Desktop properties:
  private deferFocus: boolean = null;
  biometricReady = false;
  private biometricAsked = false;
  private autoPromptBiometric = false;
  private timerId: any;

  // Browser extension properties:
  private isInitialLockScreen = (window as any).previousPopupUrl == null;
  biometricError: string;
  pendingBiometric = false;
  isFido2Session: boolean = false;

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private pinService: PinServiceAbstraction,
    private userVerificationService: UserVerificationService,
    private cryptoService: CryptoService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private router: Router,
    private dialogService: DialogService,
    private messagingService: MessagingService,
    private biometricStateService: BiometricStateService,
    private ngZone: NgZone,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private logService: LogService,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private syncService: SyncService,
    private policyService: InternalPolicyService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private formBuilder: FormBuilder,

    private lockComponentService: LockComponentService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,

    // desktop deps
    private broadcasterService: BroadcasterService,
    private activatedRoute: ActivatedRoute,
  ) {}

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        switchMap(async (account) => {
          this.activeAccount = account;
          await this.load(account);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Identify client
    const clientType = this.platformUtilsService.getClientType();

    if (clientType === "desktop") {
      await this.desktopOnInit();
    }

    if (clientType === "browser") {
      await this.extensionOnInit();
    }
  }

  // Base component methods
  private async load(activeAccount: { id: UserId | undefined } & AccountInfo) {
    this.setEmailAsPageSubtitle(activeAccount.email);

    this.pinEnabled = await this.pinService.isPinDecryptionAvailable(activeAccount.id);

    this.masterPasswordEnabled = await this.userVerificationService.hasMasterPassword();

    // TODO: do we even need this?
    this.supportsBiometric = await this.platformUtilsService.supportsBiometric();

    // TODO: This really should be biometricsLockSet, or biometricsUnlockEnabled or something.
    this.biometricLock =
      (await this.vaultTimeoutSettingsService.isBiometricLockSet()) &&
      ((await this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric)) ||
        !this.platformUtilsService.supportsSecureStorage());

    // This is redundant.
    // this.email = activeAccount.email;

    this.webVaultHostname = (await this.environmentService.getEnvironment()).getHostname();
  }

  private setEmailAsPageSubtitle(email: string) {
    // This doesn't work until we can pass whether we want the value translated or not.
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageSubtitle: email,
    });
  }

  async submit() {
    if (this.pinEnabled) {
      return await this.handlePinRequiredUnlock();
    }

    await this.handleMasterPasswordRequiredUnlock();
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    if (confirmed) {
      this.messagingService.send("logout", { userId: this.activeAccount.id });
    }
  }

  async unlockBiometric(): Promise<boolean> {
    if (!this.biometricLock) {
      return;
    }

    await this.biometricStateService.setUserPromptCancelled();
    const userKey = await this.cryptoService.getUserKeyFromStorage(KeySuffixOptions.Biometric);

    if (userKey) {
      await this.setUserKeyAndContinue(userKey, false);
    }

    return !!userKey;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    const input = document.getElementById(this.pinEnabled ? "pin" : "masterPassword");
    if (this.ngZone.isStable) {
      input.focus();
    } else {
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      this.ngZone.onStable.pipe(take(1)).subscribe(() => input.focus());
    }
  }

  private async handlePinRequiredUnlock() {
    if (this.pin == null || this.pin === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("pinRequired"),
      );
      return;
    }

    return await this.doUnlockWithPin();
  }

  private async doUnlockWithPin() {
    const MAX_INVALID_PIN_ENTRY_ATTEMPTS = 5;

    try {
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      const userKey = await this.pinService.decryptUserKeyWithPin(this.pin, userId);

      if (userKey) {
        await this.setUserKeyAndContinue(userKey);
        return; // successfully unlocked
      }

      // Failure state: invalid PIN or failed decryption
      this.invalidPinAttempts++;

      // Log user out if they have entered an invalid PIN too many times
      if (this.invalidPinAttempts >= MAX_INVALID_PIN_ENTRY_ATTEMPTS) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("tooManyInvalidPinEntryAttemptsLoggingOut"),
        );
        this.messagingService.send("logout");
        return;
      }

      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidPin"),
      );
    } catch {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("unexpectedError"),
      );
    }
  }

  private async handleMasterPasswordRequiredUnlock() {
    if (this.masterPassword == null || this.masterPassword === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPasswordRequired"),
      );
      return;
    }
    await this.doUnlockWithMasterPassword();
  }

  private async doUnlockWithMasterPassword() {
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    const verification = {
      type: VerificationType.MasterPassword,
      secret: this.masterPassword,
    } as MasterPasswordVerification;

    let passwordValid = false;
    let response: MasterPasswordVerificationResponse;
    try {
      this.formPromise = this.userVerificationService.verifyUserByMasterPassword(
        verification,
        userId,
        this.activeAccount.email,
      );
      response = await this.formPromise;
      this.enforcedMasterPasswordOptions = MasterPasswordPolicyOptions.fromResponse(
        response.policyOptions,
      );
      passwordValid = true;
    } catch (e) {
      this.logService.error(e);
    } finally {
      this.formPromise = null;
    }

    if (!passwordValid) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidMasterPassword"),
      );
      return;
    }

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      response.masterKey,
    );
    await this.setUserKeyAndContinue(userKey, true);
  }

  private async setUserKeyAndContinue(key: UserKey, evaluatePasswordAfterUnlock = false) {
    await this.cryptoService.setUserKey(key);

    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    await this.deviceTrustService.trustDeviceIfRequired(activeAccount.id);

    await this.doContinue(evaluatePasswordAfterUnlock);
  }

  private async doContinue(evaluatePasswordAfterUnlock: boolean) {
    await this.biometricStateService.resetUserPromptCancelled();
    this.messagingService.send("unlocked");

    if (evaluatePasswordAfterUnlock) {
      try {
        // If we do not have any saved policies, attempt to load them from the service
        if (this.enforcedMasterPasswordOptions == undefined) {
          this.enforcedMasterPasswordOptions = await firstValueFrom(
            this.policyService.masterPasswordPolicyOptions$(),
          );
        }

        if (this.requirePasswordChange()) {
          const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
          await this.masterPasswordService.setForceSetPasswordReason(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.forcePasswordResetRoute]);
          return;
        }
      } catch (e) {
        // Do not prevent unlock if there is an error evaluating policies
        this.logService.error(e);
      }
    }

    // Vault can be de-synced since notifications get ignored while locked. Need to check whether sync is required using the sync service.
    await this.syncService.fullSync(false);

    if (this.onSuccessfulSubmit != null) {
      await this.onSuccessfulSubmit();
    } else if (this.router != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate([this.successRoute]);
    }
  }

  /**
   * Checks if the master password meets the enforced policy requirements
   * If not, returns false
   */
  private requirePasswordChange(): boolean {
    if (
      this.enforcedMasterPasswordOptions == undefined ||
      !this.enforcedMasterPasswordOptions.enforceOnLogin
    ) {
      return false;
    }

    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      this.masterPassword,
      this.activeAccount.email,
    )?.score;

    return !this.policyService.evaluateMasterPassword(
      passwordStrength,
      this.masterPassword,
      this.enforcedMasterPasswordOptions,
    );
  }

  // -----------------------------------------------------------------------------------------------
  // Desktop methods:
  // -----------------------------------------------------------------------------------------------

  async desktopOnInit() {
    this.autoPromptBiometric = await firstValueFrom(
      this.biometricStateService.promptAutomatically$,
    );
    this.biometricReady = await this.canUseBiometric();

    await this.displayBiometricUpdateWarning();

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.delayedAskForBiometric(500);
    this.activatedRoute.queryParams.pipe(
      switchMap((params) => this.delayedAskForBiometric(500, params)),
    );

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          case "windowIsFocused":
            if (this.deferFocus === null) {
              this.deferFocus = !message.windowIsFocused;
              if (!this.deferFocus) {
                this.focusInput();
              }
            } else if (this.deferFocus && message.windowIsFocused) {
              this.focusInput();
              this.deferFocus = false;
            }
            break;
          default:
        }
      });
    });
    this.messagingService.send("getWindowIsFocused");

    // start background listener until destroyed on interval
    this.timerId = setInterval(async () => {
      this.supportsBiometric = await this.platformUtilsService.supportsBiometric();
      this.biometricReady = await this.canUseBiometric();
    }, 1000);
  }

  private async canUseBiometric() {
    return await this.lockComponentService.biometricsEnabled(this.activeAccount.id);
  }

  private async displayBiometricUpdateWarning(): Promise<void> {
    if (await firstValueFrom(this.biometricStateService.dismissedRequirePasswordOnStartCallout$)) {
      return;
    }

    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    if (await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)) {
      const response = await this.dialogService.openSimpleDialog({
        title: { key: "windowsBiometricUpdateWarningTitle" },
        content: { key: "windowsBiometricUpdateWarning" },
        type: "warning",
      });

      await this.biometricStateService.setRequirePasswordOnStart(response);
      if (response) {
        await this.biometricStateService.setPromptAutomatically(false);
      }
      this.supportsBiometric = await this.canUseBiometric();
      await this.biometricStateService.setDismissedRequirePasswordOnStartCallout();
    }
  }

  private async delayedAskForBiometric(delay: number, params?: any) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (params && !params.promptBiometric) {
      return;
    }

    if (!this.supportsBiometric || !this.autoPromptBiometric || this.biometricAsked) {
      return;
    }

    if (await firstValueFrom(this.biometricStateService.promptCancelled$)) {
      return;
    }

    this.biometricAsked = true;
    if (await this.lockComponentService.isWindowVisible()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.unlockBiometric();
    }
  }

  onWindowHidden() {
    this.showPassword = false;
  }

  private focusInput() {
    document.getElementById(this.pinEnabled ? "pin" : "masterPassword")?.focus();
  }

  // -----------------------------------------------------------------------------------------------
  // Browser Extension methods:
  // -----------------------------------------------------------------------------------------------

  async extensionOnInit() {
    this.isFido2Session = await this.lockComponentService.isFido2Session();

    const autoBiometricsPrompt = await firstValueFrom(
      this.biometricStateService.promptAutomatically$,
    );

    window.setTimeout(async () => {
      this.focusInput();
      if (
        this.biometricLock &&
        autoBiometricsPrompt &&
        this.isInitialLockScreen &&
        (await this.authService.getAuthStatus()) === AuthenticationStatus.Locked
      ) {
        await this.extensionUnlockBiometric();
      }
    }, 100);
  }

  private async extensionUnlockBiometric(): Promise<boolean> {
    if (!this.biometricLock) {
      return;
    }

    this.pendingBiometric = true;
    this.biometricError = null;

    let success;
    try {
      success = await this.unlockBiometric();
    } catch (e) {
      // TODO: these errors are only used in the extension
      // Must move logic into services.
      // const error = BiometricErrors[e?.message as BiometricErrorTypes];
      // if (error == null) {
      //   this.logService.error("Unknown error: " + e);
      //   return false;
      // }
      // this.biometricError = this.i18nService.t(error.description);
    } finally {
      this.pendingBiometric = false;
    }

    return success;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Desktop cleanup
    clearInterval(this.timerId);
  }
}
