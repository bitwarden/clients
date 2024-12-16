// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, interval, merge, Subject } from "rxjs";
import { concatMap, filter, map, switchMap, take, takeUntil } from "rxjs/operators";

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
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
} from "@bitwarden/common/auth/types/verification";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  KeyService,
  BiometricStateService,
  BiometricsService,
  BiometricsStatus,
  KdfConfigService,
} from "@bitwarden/key-management";

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
  biometricStatus: BiometricsStatus = BiometricsStatus.NotEnabledLocally;

  protected activeUserId: UserId;
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";
  protected onSuccessfulSubmit: () => Promise<void>;

  private invalidPinAttempts = 0;
  private pinLockType: PinLockType;

  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions = undefined;

  protected destroy$ = new Subject<void>();

  constructor(
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected router: Router,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected keyService: KeyService,
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
    protected toastService: ToastService,
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

    this.biometricStatus = BiometricsStatus.NotEnabledLocally;
    merge(interval(1000), this.accountService.activeAccount$)
      .pipe(
        filter(() => this.activeUserId != null),
        switchMap(async () => {
          if (!(await this.vaultTimeoutSettingsService.isBiometricLockSet(this.activeUserId))) {
            this.biometricStatus = BiometricsStatus.NotEnabledLocally;
          } else {
            this.biometricStatus = await this.biometricsService.getBiometricsStatusForUser(
              this.activeUserId,
            );
          }
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
    await this.biometricStateService.setUserPromptCancelled();
    const userKey = await this.biometricsService.unlockWithBiometricsForUser(this.activeUserId);
    if (userKey) {
      await this.setUserKeyAndContinue(userKey, this.activeUserId, false);
    }

    return !!userKey;
  }

  get showBiometricsButton(): boolean {
    return this.biometricStatus != BiometricsStatus.NotEnabledLocally;
  }

  get biometricUnavailabilityReason(): string {
    switch (this.biometricStatus) {
      case BiometricsStatus.Available:
        return "";
      case BiometricsStatus.UnlockNeeded:
        return this.i18nService.t("biometricsStatusHelptextUnlockNeeded");
      case BiometricsStatus.HardwareUnavailable:
        return this.i18nService.t("biometricsStatusHelptextHardwareUnavailable");
      case BiometricsStatus.AutoSetupNeeded:
        return this.i18nService.t("biometricsStatusHelptextAutoSetupNeeded");
      case BiometricsStatus.ManualSetupNeeded:
        return this.i18nService.t("biometricsStatusHelptextManualSetupNeeded");
      case BiometricsStatus.NotEnabledInConnectedDesktopApp:
        return this.i18nService.t("biometricsStatusHelptextNotEnabledInDesktop", this.email);
      case BiometricsStatus.NotEnabledLocally:
        return this.i18nService.t("biometricsStatusHelptextNotEnabledInDesktop", this.email);
      case BiometricsStatus.DesktopDisconnected:
        return this.i18nService.t("biometricsStatusHelptextDesktopDisconnected");
      default:
        return (
          this.i18nService.t("biometricsStatusHelptextUnavailableReasonUnknown") +
          this.biometricStatus
        );
    }
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
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("pinRequired"),
      });
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
        await this.setUserKeyAndContinue(userKey, userId);
        return; // successfully unlocked
      }

      // Failure state: invalid PIN or failed decryption
      this.invalidPinAttempts++;

      // Log user out if they have entered an invalid PIN too many times
      if (this.invalidPinAttempts >= MAX_INVALID_PIN_ENTRY_ATTEMPTS) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("tooManyInvalidPinEntryAttemptsLoggingOut"),
        });
        this.messagingService.send("logout");
        return;
      }

      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidPin"),
      });
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("unexpectedError"),
      });
    }
  }

  private async handleMasterPasswordRequiredUnlock() {
    if (this.masterPassword == null || this.masterPassword === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
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
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      response.masterKey,
      userId,
    );
    await this.setUserKeyAndContinue(userKey, userId, true);
  }

  private async setUserKeyAndContinue(
    key: UserKey,
    userId: UserId,
    evaluatePasswordAfterUnlock = false,
  ) {
    await this.keyService.setUserKey(key, userId);

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
    const clientType = this.platformUtilsService.getClientType();
    if (clientType === ClientType.Browser || clientType === ClientType.Desktop) {
      // Desktop and Browser have better offline support and to facilitate this we don't make the user wait for what
      // could be an HTTP Timeout because their server is unreachable.
      await Promise.race([
        this.syncService
          .fullSync(false)
          .catch((err) => this.logService.error("Error during unlock sync", err)),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            this.logService.warning("Skipping sync wait, continuing to unlock.");
            resolve();
          }, 5_000),
        ),
      ]);
    } else {
      await this.syncService.fullSync(false);
    }

    if (this.onSuccessfulSubmit != null) {
      await this.onSuccessfulSubmit();
    } else if (this.router != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate([this.successRoute]);
    }
  }

  private async load(userId: UserId) {
    this.pinLockType = await this.pinService.getPinLockType(userId);

    this.pinEnabled = await this.pinService.isPinDecryptionAvailable(userId);

    this.masterPasswordEnabled = await this.userVerificationService.hasMasterPassword();

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
