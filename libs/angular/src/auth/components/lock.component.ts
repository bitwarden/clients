import { Directive, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, Subject } from "rxjs";
import { concatMap, map, take, takeUntil } from "rxjs/operators";

import { PinServiceAbstraction, PinLockType } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
} from "@bitwarden/common/auth/types/verification";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { BiometricsService } from "@bitwarden/common/platform/biometrics/biometric.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

@Directive()
export class LockComponent implements OnInit, OnDestroy {
  masterPassword = "";
  pin = "";
  showPassword = false;
  email: string;
  pinEnabled = false;
  masterPasswordEnabled = false;
  webVaultHostname = "";
  formPromise: Promise<MasterPasswordVerificationResponse>;
  supportsBiometric: boolean;
  biometricLock: boolean;

  private activeUserId: UserId;
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";
  protected onSuccessfulSubmit: () => Promise<void>;

  private invalidPinAttempts = 0;
  private pinLockType: PinLockType;

  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions = undefined;

  private destroy$ = new Subject<void>();

  constructor(
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected router: Router,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected cryptoService: CryptoService,
    protected vaultTimeoutService: VaultTimeoutService,
    protected vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected apiService: ApiService,
    protected logService: LogService,
    protected ngZone: NgZone,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: InternalPolicyService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected dialogService: DialogService,
    protected deviceTrustService: DeviceTrustServiceAbstraction,
    protected userVerificationService: UserVerificationService,
    protected pinService: PinServiceAbstraction,
    protected biometricStateService: BiometricStateService,
    protected biometricsService: BiometricsService,
    protected accountService: AccountService,
    protected authService: AuthService,
    protected kdfConfigService: KdfConfigService,
    protected syncService: SyncService,
  ) {}

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        concatMap(async (account) => {
          this.activeUserId = account?.id;
          await this.load(account?.id);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
      this.messagingService.send("logout", { userId: this.activeUserId });
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

  async isBiometricUnlockAvailable(): Promise<boolean> {
    if (!(await this.biometricsService.supportsBiometric())) {
      return false;
    }
    return this.biometricsService.isBiometricUnlockAvailable();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    const input = document.getElementById(this.pinEnabled ? "pin" : "masterPassword");
    if (this.ngZone.isStable) {
      input.focus();
    } else {
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
        this.email,
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

  private async load(userId: UserId) {
    // TODO: Investigate PM-3515

    // The loading of the lock component works as follows:
    //   1. If the user is unlocked, we're here in error so we navigate to the home page
    //   2. First, is locking a valid timeout action?  If not, we will log the user out.
    //   3. If locking IS a valid timeout action, we proceed to show the user the lock screen.
    //      The user will be able to unlock as follows:
    //        - If they have a PIN set, they will be presented with the PIN input
    //        - If they have a master password and no PIN, they will be presented with the master password input
    //        - If they have biometrics enabled, they will be presented with the biometric prompt

    const isUnlocked = await firstValueFrom(
      this.authService
        .authStatusFor$(userId)
        .pipe(map((status) => status === AuthenticationStatus.Unlocked)),
    );
    if (isUnlocked) {
      // navigate to home
      await this.router.navigate(["/"]);
      return;
    }

    const availableVaultTimeoutActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(userId),
    );
    const supportsLock = availableVaultTimeoutActions.includes(VaultTimeoutAction.Lock);
    if (!supportsLock) {
      return await this.vaultTimeoutService.logOut(userId);
    }

    this.pinLockType = await this.pinService.getPinLockType(userId);

    const ephemeralPinSet = await this.pinService.getPinKeyEncryptedUserKeyEphemeral(userId);

    this.pinEnabled =
      (this.pinLockType === "EPHEMERAL" && !!ephemeralPinSet) || this.pinLockType === "PERSISTENT";

    this.masterPasswordEnabled = await this.userVerificationService.hasMasterPassword();

    this.supportsBiometric = await this.biometricsService.supportsBiometric();
    this.biometricLock =
      (await this.vaultTimeoutSettingsService.isBiometricLockSet()) &&
      ((await this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric)) ||
        !this.platformUtilsService.supportsSecureStorage());
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    this.webVaultHostname = (await this.environmentService.getEnvironment()).getHostname();
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
      this.email,
    )?.score;

    return !this.policyService.evaluateMasterPassword(
      passwordStrength,
      this.masterPassword,
      this.enforcedMasterPasswordOptions,
    );
  }
}
