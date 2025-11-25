import { CommonModule } from "@angular/common";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  interval,
  mergeMap,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogoutService } from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
} from "@bitwarden/common/auth/types/verification";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserKey } from "@bitwarden/common/types/key";
import {
  AsyncActionsModule,
  AnonLayoutWrapperDataService,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import {
  KeyService,
  BiometricStateService,
  BiometricsService,
  BiometricsStatus,
  UserAsymmetricKeysRegenerationService,
} from "@bitwarden/key-management";

import {
  UnlockOption,
  LockComponentService,
  UnlockOptions,
  UnlockOptionValue,
} from "../services/lock-component.service";

import { MasterPasswordLockComponent } from "./master-password-lock/master-password-lock.component";

const BroadcasterSubscriptionId = "LockComponent";

const clientTypeToSuccessRouteRecord: Partial<Record<ClientType, string>> = {
  [ClientType.Web]: "vault",
  [ClientType.Desktop]: "vault",
  [ClientType.Browser]: "/tabs/current",
};

type AfterUnlockActions = {
  passwordEvaluation?: {
    masterPassword: string;
  };
};

/// The minimum amount of time to wait after a process reload for a biometrics auto prompt to be possible
/// Fixes safari autoprompt behavior
const AUTOPROMPT_BIOMETRICS_PROCESS_RELOAD_DELAY = 5000;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-lock",
  templateUrl: "lock.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
    MasterPasswordLockComponent,
  ],
})
export class LockComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected loading = true;

  protected unlockWithMasterPasswordUnlockDataFlag$ = this.configService.getFeatureFlag$(
    FeatureFlag.UnlockWithMasterPasswordUnlockData,
  );

  activeAccount: Account | null = null;

  clientType?: ClientType;

  unlockOptions: UnlockOptions | null = null;

  UnlockOption = UnlockOption;

  private _activeUnlockOptionBSubject: BehaviorSubject<UnlockOptionValue | null> =
    new BehaviorSubject<UnlockOptionValue | null>(null);

  activeUnlockOption$ = this._activeUnlockOptionBSubject.asObservable();

  set activeUnlockOption(value: UnlockOptionValue | null) {
    this._activeUnlockOptionBSubject.next(value);
  }

  get activeUnlockOption(): UnlockOptionValue | null {
    return this._activeUnlockOptionBSubject.value;
  }

  private invalidPinAttempts = 0;

  biometricUnlockBtnText?: string;

  // masterPassword = "";
  showPassword = false;
  private enforcedMasterPasswordOptions?: MasterPasswordPolicyOptions = undefined;

  formGroup: FormGroup | null = null;

  // Browser extension properties:
  shouldClosePopout = false;

  // Desktop properties:
  private deferFocus: boolean | null = null;
  private biometricAsked = false;

  defaultUnlockOptionSetForUser = false;

  unlockingViaBiometrics = false;

  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private userVerificationService: UserVerificationService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
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
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private biometricService: BiometricsService,
    private logoutService: LogoutService,
    private lockComponentService: LockComponentService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private configService: ConfigService,
    // desktop deps
    private broadcasterService: BroadcasterService,
  ) {}

  async ngOnInit() {
    this.listenForActiveUnlockOptionChanges();

    // Listen for active account changes
    this.listenForActiveAccountChanges();

    this.listenForUnlockOptionsChanges();

    // Identify client
    this.clientType = this.platformUtilsService.getClientType();

    if (this.clientType === ClientType.Desktop) {
      await this.desktopOnInit();
    } else if (this.clientType === ClientType.Browser) {
      this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();
    }
  }

  private listenForUnlockOptionsChanges() {
    interval(1000)
      .pipe(
        mergeMap(async () => {
          if (this.activeAccount?.id != null) {
            this.unlockOptions = await firstValueFrom(
              this.lockComponentService.getAvailableUnlockOptions$(this.activeAccount.id),
            );
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Base component methods
  private listenForActiveUnlockOptionChanges() {
    this.activeUnlockOption$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeUnlockOption: UnlockOptionValue | null) => {
        if (activeUnlockOption === UnlockOption.Pin) {
          this.buildPinForm();
        } else if (activeUnlockOption === UnlockOption.MasterPassword) {
          this.buildMasterPasswordForm();
        }
      });
  }

  buildMasterPasswordForm() {
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
        tap((account) => {
          this.loading = true;
          this.activeAccount = account;
          this.resetDataOnActiveAccountChange();
        }),
        filter((account): account is Account => account != null),
        switchMap(async (account) => {
          await this.handleActiveAccountChange(account);
          this.loading = false;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async handleActiveAccountChange(activeAccount: Account) {
    // this account may be unlocked, prevent any prompts so we can redirect to vault
    if (await this.keyService.hasUserKey(activeAccount.id)) {
      return;
    }

    this.setEmailAsPageSubtitle(activeAccount.email);

    this.unlockOptions = await firstValueFrom(
      this.lockComponentService.getAvailableUnlockOptions$(activeAccount.id),
    );

    this.setDefaultActiveUnlockOption(this.unlockOptions);

    if (this.unlockOptions?.biometrics.enabled) {
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
      pageSubtitle: email,
    });
  }

  private setDefaultActiveUnlockOption(unlockOptions: UnlockOptions | null) {
    // Priorities should be Biometrics > Pin > Master Password for speed
    if (unlockOptions?.biometrics.enabled) {
      this.activeUnlockOption = UnlockOption.Biometrics;
    } else if (unlockOptions?.pin.enabled) {
      this.activeUnlockOption = UnlockOption.Pin;
    } else if (unlockOptions?.masterPassword.enabled) {
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
        this.loading = false;
        await this.desktopAutoPromptBiometrics();
      }
    }

    if (this.clientType === "browser") {
      if (
        this.unlockOptions?.biometrics.enabled &&
        autoPromptBiometrics &&
        (await this.biometricService.getShouldAutopromptNow())
      ) {
        await this.biometricService.setShouldAutopromptNow(false);

        const lastProcessReload = await this.biometricStateService.getLastProcessReload();
        if (
          lastProcessReload == null ||
          isNaN(lastProcessReload.getTime()) ||
          Date.now() - lastProcessReload.getTime() > AUTOPROMPT_BIOMETRICS_PROCESS_RELOAD_DELAY
        ) {
          // Firefox extension closes the popup when unfocused during biometric unlock, pop out the window to prevent infinite loop.
          if (this.platformUtilsService.getDevice() === DeviceType.FirefoxExtension) {
            await this.lockComponentService.popOutBrowserExtension();
            this.shouldClosePopout = true;
          }
          this.loading = false;
          await this.unlockViaBiometrics();
        }
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

    if (confirmed && this.activeAccount != null) {
      await this.logoutService.logout(this.activeAccount.id);
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    }
  }

  async unlockViaBiometrics(): Promise<void> {
    this.unlockingViaBiometrics = true;

    if (
      this.unlockOptions == null ||
      !this.unlockOptions.biometrics.enabled ||
      this.activeAccount == null
    ) {
      this.unlockingViaBiometrics = false;
      return;
    }

    try {
      await this.biometricStateService.setUserPromptCancelled();
      const userKey = await this.biometricService.unlockWithBiometricsForUser(
        this.activeAccount.id,
      );

      // If user cancels biometric prompt, userKey is undefined.
      if (userKey) {
        await this.setUserKeyAndContinue(userKey);
      }

      this.unlockingViaBiometrics = false;
    } catch (e) {
      // Cancelling is a valid action.
      if (e instanceof Error && e.message === "canceled") {
        this.unlockingViaBiometrics = false;
        return;
      }

      this.logService.error("[LockComponent] Failed to unlock via biometrics.", e);

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

  //TODO PM-25385 This code isn't used and should be removed when removing the UnlockWithMasterPasswordUnlockData feature flag.
  togglePassword() {
    this.showPassword = !this.showPassword;
    const input = document.getElementById(
      this.unlockOptions?.pin.enabled ? "pin" : "masterPassword",
    );

    if (input == null) {
      return;
    }

    if (this.ngZone.isStable) {
      input.focus();
    } else {
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      this.ngZone.onStable.pipe(take(1)).subscribe(() => input.focus());
    }
  }

  private validatePin(): boolean {
    if (this.formGroup?.invalid) {
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
    if (!this.validatePin() || this.formGroup == null || this.activeAccount == null) {
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

  // TODO PM-25385 remove when removing the UnlockWithMasterPasswordUnlockData feature flag.
  private validateMasterPassword(): boolean {
    if (this.formGroup?.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return false;
    }

    return true;
  }

  // TODO PM-25385 remove when removing the UnlockWithMasterPasswordUnlockData feature flag.
  async unlockViaMasterPassword() {
    if (!this.validateMasterPassword() || this.formGroup == null || this.activeAccount == null) {
      return;
    }

    const masterPassword = this.formGroup.controls.masterPassword.value;

    const verification = {
      type: VerificationType.MasterPassword,
      secret: masterPassword,
    } as MasterPasswordVerification;

    let passwordValid = false;
    let masterPasswordVerificationResponse: MasterPasswordVerificationResponse | null = null;
    try {
      masterPasswordVerificationResponse =
        await this.userVerificationService.verifyUserByMasterPassword(
          verification,
          this.activeAccount.id,
          this.activeAccount.email,
        );

      if (masterPasswordVerificationResponse?.policyOptions != null) {
        this.enforcedMasterPasswordOptions = MasterPasswordPolicyOptions.fromResponse(
          masterPasswordVerificationResponse.policyOptions,
        );
      } else {
        this.enforcedMasterPasswordOptions = undefined;
      }

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
      masterPasswordVerificationResponse!.masterKey,
      this.activeAccount.id,
    );
    if (userKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    await this.setUserKeyAndContinue(userKey, {
      passwordEvaluation: { masterPassword },
    });
  }

  async successfulMasterPasswordUnlock(event: {
    userKey: UserKey;
    masterPassword: string;
  }): Promise<void> {
    if (event.userKey == null || !event.masterPassword) {
      this.logService.error(
        "[LockComponent] successfulMasterPasswordUnlock called with invalid data.",
      );
      return;
    }

    await this.setUserKeyAndContinue(event.userKey, {
      passwordEvaluation: {
        masterPassword: event.masterPassword,
      },
    });
  }

  protected async setUserKeyAndContinue(
    key: UserKey,
    afterUnlockActions: AfterUnlockActions = {},
  ): Promise<void> {
    if (this.activeAccount == null) {
      throw new Error("No active user.");
    }

    // Add a mark to indicate that the user has unlocked their vault. A good starting point for measuring unlock performance.
    this.logService.mark("Vault unlocked");

    await this.keyService.setUserKey(key, this.activeAccount.id);
    await this.pinService.userUnlocked(this.activeAccount.id);

    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    await this.deviceTrustService.trustDeviceIfRequired(this.activeAccount.id);

    await this.doContinue(afterUnlockActions);
  }

  private async doContinue(afterUnlockActions: AfterUnlockActions) {
    if (this.activeAccount == null) {
      throw new Error("No active user.");
    }

    await this.biometricStateService.resetUserPromptCancelled();
    this.messagingService.send("unlocked");

    if (afterUnlockActions.passwordEvaluation) {
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      if (userId == null) {
        throw new Error("No active user.");
      }

      try {
        // If we do not have any saved policies, attempt to load them from the service
        if (this.enforcedMasterPasswordOptions == undefined) {
          this.enforcedMasterPasswordOptions = await firstValueFrom(
            this.accountService.activeAccount$.pipe(
              getUserId,
              switchMap((userId) => this.policyService.masterPasswordPolicyOptions$(userId)),
            ),
          );
        }

        if (this.requirePasswordChange(afterUnlockActions.passwordEvaluation.masterPassword)) {
          await this.masterPasswordService.setForceSetPasswordReason(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
        }
      } catch (e) {
        // Do not prevent unlock if there is an error evaluating policies
        this.logService.error(e);
      }
    }

    // Vault can be de-synced since server notifications get ignored while locked. Need to check whether sync is required using the sync service.
    const startSync = new Date().getTime();
    // TODO: This should probably not be blocking
    await this.syncService.fullSync(false);
    this.logService.info(`[LockComponent] Sync took ${new Date().getTime() - startSync}ms`);

    const startRegeneration = new Date().getTime();
    // TODO: This should probably not be blocking
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(this.activeAccount.id);
    this.logService.info(
      `[LockComponent] Private key regeneration took ${new Date().getTime() - startRegeneration}ms`,
    );

    if (this.clientType === "browser") {
      const previousUrl = this.lockComponentService.getPreviousUrl();
      /**
       * In a passkey flow, the `previousUrl` will still be `/fido2?<queryParams>` at this point
       * because the `/lock` route doesn't save the URL in the `BrowserRouterService`. This is
       * handled by the `doNotSaveUrl` property on the `/lock` route in `app-routing.module.ts`.
       */
      if (previousUrl) {
        await this.router.navigateByUrl(previousUrl);
        return;
      }
    }

    // determine success route based on client type
    // The disable-redirect parameter allows callers to prevent automatic navigation after unlock,
    // useful when the lock component is used in contexts where custom post-unlock behavior is needed
    // such as passkey modals.
    if (
      this.clientType != null &&
      this.activatedRoute.snapshot.paramMap.get("disable-redirect") === null
    ) {
      const successRoute = clientTypeToSuccessRouteRecord[this.clientType];
      await this.router.navigate([successRoute]);
    }

    if (
      this.shouldClosePopout &&
      this.platformUtilsService.getDevice() === DeviceType.FirefoxExtension
    ) {
      this.lockComponentService.closeBrowserExtensionPopout();
    }
  }

  /**
   * Checks if the master password meets the enforced policy requirements
   * If not, returns false
   */
  private requirePasswordChange(masterPassword: string): boolean {
    if (
      this.enforcedMasterPasswordOptions == undefined ||
      !this.enforcedMasterPasswordOptions.enforceOnLogin ||
      this.activeAccount == null
    ) {
      return false;
    }

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
    this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();

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

    if (!(await this.biometricService.getShouldAutopromptNow())) {
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

  get biometricsAvailable(): boolean {
    return this.unlockOptions?.biometrics.enabled ?? false;
  }

  get showBiometrics(): boolean {
    if (this.unlockOptions == null) {
      return false;
    }
    return (
      this.unlockOptions.biometrics.biometricsStatus !== BiometricsStatus.PlatformUnsupported &&
      this.unlockOptions.biometrics.biometricsStatus !== BiometricsStatus.NotEnabledLocally
    );
  }

  get biometricUnavailabilityReason(): string {
    switch (this.unlockOptions?.biometrics.biometricsStatus) {
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
        return this.i18nService.t(
          "biometricsStatusHelptextNotEnabledInDesktop",
          this.activeAccount?.email,
        );
      case BiometricsStatus.NotEnabledLocally:
        return this.i18nService.t(
          "biometricsStatusHelptextNotEnabledInDesktop",
          this.activeAccount?.email,
        );
      case BiometricsStatus.DesktopDisconnected:
        return this.i18nService.t("biometricsStatusHelptextDesktopDisconnected");
      default:
        return (
          this.i18nService.t("biometricsStatusHelptextUnavailableReasonUnknown") +
          this.unlockOptions?.biometrics.biometricsStatus
        );
    }
  }
}
