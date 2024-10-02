import { CommonModule } from "@angular/common";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { BehaviorSubject, firstValueFrom, Subject, switchMap, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
  ToastService,
} from "@bitwarden/components";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";

import { PinServiceAbstraction } from "../../common/abstractions";
import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";

import {
  UnlockOption,
  LockComponentService,
  UnlockOptions,
  UnlockOptionValue,
} from "./lock-component.service";

const BroadcasterSubscriptionId = "LockComponent";

const clientTypeToSuccessRouteRecord: Partial<Record<ClientType, string>> = {
  [ClientType.Web]: "vault",
  [ClientType.Desktop]: "vault",
  [ClientType.Browser]: "/tabs/current",
};

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

  clientType: ClientType;
  ClientType = ClientType;

  unlockOptions: UnlockOptions = null;

  UnlockOption = UnlockOption;

  private _activeUnlockOptionBSubject: BehaviorSubject<UnlockOptionValue> =
    new BehaviorSubject<UnlockOptionValue>(null);

  activeUnlockOption$ = this._activeUnlockOptionBSubject.asObservable();

  set activeUnlockOption(value: UnlockOptionValue) {
    this._activeUnlockOptionBSubject.next(value);
  }

  get activeUnlockOption(): UnlockOptionValue {
    return this._activeUnlockOptionBSubject.value;
  }

  private invalidPinAttempts = 0;

  biometricUnlockBtnText: string;

  // masterPassword = "";
  showPassword = false;
  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions = undefined;

  forcePasswordResetRoute = "update-temp-password";

  formGroup: FormGroup;

  // Desktop properties:
  private deferFocus: boolean = null;
  private biometricAsked = false;

  // Browser extension properties:
  private isInitialLockScreen = (window as any).previousPopupUrl == null;

  defaultUnlockOptionSetForUser = false;

  unlockingViaBiometrics = false;

  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private userVerificationService: UserVerificationService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
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
    private toastService: ToastService,

    private lockComponentService: LockComponentService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,

    // desktop deps
    private broadcasterService: BroadcasterService,
  ) {}

  async ngOnInit() {
    this.listenForActiveUnlockOptionChanges();

    // Listen for active account changes
    this.listenForActiveAccountChanges();

    // Identify client
    this.clientType = this.platformUtilsService.getClientType();

    if (this.clientType === "desktop") {
      await this.desktopOnInit();
    }
  }

  // Base component methods
  private listenForActiveUnlockOptionChanges() {
    this.activeUnlockOption$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeUnlockOption: UnlockOptionValue) => {
        if (activeUnlockOption === UnlockOption.Pin) {
          this.buildPinForm();
        } else if (activeUnlockOption === UnlockOption.MasterPassword) {
          this.buildMasterPasswordForm();
        }
      });
  }

  private buildMasterPasswordForm() {
    this.formGroup = this.formBuilder.group(
      {
        masterPassword: ["", [Validators.required]],
      },
      { updateOn: "submit" },
    );
  }

  private buildPinForm() {
    this.formGroup = this.formBuilder.group(
      {
        pin: ["", [Validators.required]],
      },
      { updateOn: "submit" },
    );
  }

  private listenForActiveAccountChanges() {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          return this.handleActiveAccountChange(account);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async handleActiveAccountChange(activeAccount: { id: UserId | undefined } & AccountInfo) {
    this.activeAccount = activeAccount;

    this.resetDataOnActiveAccountChange();

    this.setEmailAsPageSubtitle(activeAccount.email);

    this.unlockOptions = await firstValueFrom(
      this.lockComponentService.getAvailableUnlockOptions$(activeAccount.id),
    );

    this.setDefaultActiveUnlockOption(this.unlockOptions);

    if (this.unlockOptions.biometrics.enabled) {
      await this.handleBiometricsUnlockEnabled();
    }
  }

  private resetDataOnActiveAccountChange() {
    this.defaultUnlockOptionSetForUser = false;
    this.unlockOptions = null;
    this.activeUnlockOption = null;
    this.formGroup = null; // new form group will be created based on new active unlock option

    // Desktop properties:
    this.biometricAsked = false;
  }

  private setEmailAsPageSubtitle(email: string) {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageSubtitle: {
        subtitle: email,
        translate: false,
      },
    });
  }

  private setDefaultActiveUnlockOption(unlockOptions: UnlockOptions) {
    // Priorities should be Biometrics > Pin > Master Password for speed
    if (unlockOptions.biometrics.enabled) {
      this.activeUnlockOption = UnlockOption.Biometrics;
    } else if (unlockOptions.pin.enabled) {
      this.activeUnlockOption = UnlockOption.Pin;
    } else if (unlockOptions.masterPassword.enabled) {
      this.activeUnlockOption = UnlockOption.MasterPassword;
    }
  }

  private async handleBiometricsUnlockEnabled() {
    this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();

    const autoPromptBiometrics = await firstValueFrom(
      this.biometricStateService.promptAutomatically$,
    );

    // TODO: PM-12546 - we need to make our biometric autoprompt experience consistent between the
    // desktop and extension.
    if (this.clientType === "desktop") {
      if (autoPromptBiometrics) {
        await this.desktopAutoPromptBiometrics();
      }
    }

    if (this.clientType === "browser") {
      if (
        this.unlockOptions.biometrics.enabled &&
        autoPromptBiometrics &&
        this.isInitialLockScreen // only autoprompt biometrics on initial lock screen
      ) {
        await this.unlockViaBiometrics();
      }
    }
  }

  // Note: this submit method is only used for unlock methods that require a form and user input.
  // For biometrics unlock, the method is called directly.
  submit = async (): Promise<void> => {
    if (this.activeUnlockOption === UnlockOption.Pin) {
      return await this.unlockViaPin();
    }

    await this.unlockViaMasterPassword();
  };

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

  async unlockViaBiometrics(): Promise<void> {
    this.unlockingViaBiometrics = true;

    if (!this.unlockOptions.biometrics.enabled) {
      this.unlockingViaBiometrics = false;
      return;
    }

    try {
      await this.biometricStateService.setUserPromptCancelled();
      const userKey = await this.keyService.getUserKeyFromStorage(
        KeySuffixOptions.Biometric,
        this.activeAccount.id,
      );

      // If user cancels biometric prompt, userKey is undefined.
      if (userKey) {
        await this.setUserKeyAndContinue(userKey, false);
      }

      this.unlockingViaBiometrics = false;
    } catch (e) {
      // Cancelling is a valid action.
      if (e?.message === "canceled") {
        this.unlockingViaBiometrics = false;
        return;
      }

      let biometricTranslatedErrorDesc;

      if (this.clientType === "browser") {
        const biometricErrorDescTranslationKey = this.lockComponentService.getBiometricsError(e);

        if (biometricErrorDescTranslationKey) {
          biometricTranslatedErrorDesc = this.i18nService.t(biometricErrorDescTranslationKey);
        }
      }

      // if no translation key found, show generic error message
      if (!biometricTranslatedErrorDesc) {
        biometricTranslatedErrorDesc = this.i18nService.t("unexpectedError");
      }

      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "error" },
        content: biometricTranslatedErrorDesc,
        acceptButtonText: { key: "tryAgain" },
        type: "danger",
      });

      if (confirmed) {
        // try again
        await this.unlockViaBiometrics();
      }

      this.unlockingViaBiometrics = false;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    const input = document.getElementById(
      this.unlockOptions.pin.enabled ? "pin" : "masterPassword",
    );
    if (this.ngZone.isStable) {
      input.focus();
    } else {
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      this.ngZone.onStable.pipe(take(1)).subscribe(() => input.focus());
    }
  }

  private validatePin(): boolean {
    if (this.formGroup.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("pinRequired"),
      });
      return false;
    }

    return true;
  }

  private async unlockViaPin() {
    if (!this.validatePin()) {
      return;
    }

    const pin = this.formGroup.controls.pin.value;

    const MAX_INVALID_PIN_ENTRY_ATTEMPTS = 5;

    try {
      const userKey = await this.pinService.decryptUserKeyWithPin(pin, this.activeAccount.id);

      if (userKey) {
        await this.setUserKeyAndContinue(userKey);
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

  private validateMasterPassword(): boolean {
    if (this.formGroup.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return false;
    }

    return true;
  }

  private async unlockViaMasterPassword() {
    if (!this.validateMasterPassword()) {
      return;
    }

    const masterPassword = this.formGroup.controls.masterPassword.value;

    const verification = {
      type: VerificationType.MasterPassword,
      secret: masterPassword,
    } as MasterPasswordVerification;

    let passwordValid = false;
    let masterPasswordVerificationResponse: MasterPasswordVerificationResponse;
    try {
      masterPasswordVerificationResponse =
        await this.userVerificationService.verifyUserByMasterPassword(
          verification,
          this.activeAccount.id,
          this.activeAccount.email,
        );

      this.enforcedMasterPasswordOptions = MasterPasswordPolicyOptions.fromResponse(
        masterPasswordVerificationResponse.policyOptions,
      );
      passwordValid = true;
    } catch (e) {
      this.logService.error(e);
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
      masterPasswordVerificationResponse.masterKey,
    );
    await this.setUserKeyAndContinue(userKey, true);
  }

  private async setUserKeyAndContinue(key: UserKey, evaluatePasswordAfterUnlock = false) {
    await this.keyService.setUserKey(key, this.activeAccount.id);

    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    await this.deviceTrustService.trustDeviceIfRequired(this.activeAccount.id);

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
          await this.router.navigate([this.forcePasswordResetRoute]);
          return;
        }
      } catch (e) {
        // Do not prevent unlock if there is an error evaluating policies
        this.logService.error(e);
      }
    }

    // Vault can be de-synced since notifications get ignored while locked. Need to check whether sync is required using the sync service.
    await this.syncService.fullSync(false);

    if (this.clientType === "browser") {
      const previousUrl = this.lockComponentService.getPreviousUrl();
      if (previousUrl) {
        await this.router.navigateByUrl(previousUrl);
      }
    }

    // determine success route based on client type
    const successRoute = clientTypeToSuccessRouteRecord[this.clientType];
    await this.router.navigate([successRoute]);
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

    const masterPassword = this.formGroup.controls.masterPassword.value;

    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.activeAccount.email,
    )?.score;

    return !this.policyService.evaluateMasterPassword(
      passwordStrength,
      masterPassword,
      this.enforcedMasterPasswordOptions,
    );
  }

  // -----------------------------------------------------------------------------------------------
  // Desktop methods:
  // -----------------------------------------------------------------------------------------------

  async desktopOnInit() {
    // TODO: move this into a WindowService and subscribe to messages via MessageListener service.
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
  }

  private async desktopAutoPromptBiometrics() {
    if (!this.unlockOptions?.biometrics?.enabled || this.biometricAsked) {
      return;
    }

    // prevent the biometric prompt from showing if the user has already cancelled it
    if (await firstValueFrom(this.biometricStateService.promptCancelled$)) {
      return;
    }

    const windowVisible = await this.lockComponentService.isWindowVisible();

    if (windowVisible) {
      this.biometricAsked = true;
      await this.unlockViaBiometrics();
    }
  }

  onWindowHidden() {
    this.showPassword = false;
  }

  private focusInput() {
    if (this.unlockOptions) {
      document.getElementById(this.unlockOptions.pin.enabled ? "pin" : "masterPassword")?.focus();
    }
  }

  // -----------------------------------------------------------------------------------------------

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.clientType === "desktop") {
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    }
  }
}
