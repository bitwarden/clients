// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  concatMap,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import { LockService } from "@bitwarden/auth/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
  ToastService,
  SwitchComponent,
  CalloutModule,
  SpinnerComponent,
} from "@bitwarden/components";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";
import { SessionTimeoutSettingsComponent } from "@bitwarden/key-management-ui";

import {
  NativeMessagingPermissionDialogComponent,
  NativeMessagingPermissionDialogType,
} from "../../../key-management/shared-unlock/popup/native-messaging-permission-dialog.component";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { SetPinComponent } from "../components/set-pin.component";
import { AuthExtensionRoute } from "../constants/auth-extension-route.constant";

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
    IconModule,
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
    TypographyModule,
    SwitchComponent,
    CalloutModule,
    SpinnerComponent,
  ],
})
export class AccountSecurityComponent implements OnInit, OnDestroy {
  showMasterPasswordOnClientRestartOption = true;
  showChangeMasterPass = true;
  pinEnabled$: Observable<boolean> = of(true);
  protected readonly loading = signal(true);

  form = this.formBuilder.group({
    pin: [null as boolean | null],
    pinLockWithMasterPassword: false,
    biometric: false,
    enableAutoBiometricsPrompt: true,
    enablePhishingDetection: true,
    allowSharingUnlockStateWithDesktop: false,
    allowSharingUnlockStateWithWeb: false,
  });

  protected showAccountSecurityNudge$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.vaultNudgesService.showNudgeSpotlight$(NudgeType.AccountSecurity, userId),
      ),
    );

  protected readonly phishingDetectionAvailable$: Observable<boolean>;
  protected readonly sharedUnlockFeatureEnabled$: Observable<boolean>;
  protected readonly multiClientPasswordManagement$: Observable<boolean>;

  // Native messaging with the desktop app is unavailable on Safari.
  protected readonly showSharedUnlockWithDesktop: boolean;
  // Firefox does not support sharing unlock state with the web vault.
  protected readonly showSharedUnlockWithWeb: boolean;

  protected refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private configService: ConfigService,
    private router: Router,
    private route: ActivatedRoute,
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private lockService: LockService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    public messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private keyService: KeyService,
    private userVerificationService: UserVerificationService,
    private dialogService: DialogService,
    private biometricStateService: BiometricStateService,
    private toastService: ToastService,
    private vaultNudgesService: NudgesService,
    private logService: LogService,
    private phishingDetectionSettingsService: PhishingDetectionSettingsServiceAbstraction,
    private sharedUnlockSettingsService: SharedUnlockSettingsService,
  ) {
    this.multiClientPasswordManagement$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM32413_MultiClientPasswordManagement,
    );

    // Check if user phishing detection available
    this.phishingDetectionAvailable$ = this.phishingDetectionSettingsService.available$;
    this.sharedUnlockFeatureEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.SharedUnlockPart2,
    );

    this.showSharedUnlockWithDesktop = !this.platformUtilsService.isSafari();
    this.showSharedUnlockWithWeb = !this.platformUtilsService.isFirefox();
  }

  async ngOnInit() {
    const hasMasterPassword = await this.userVerificationService.hasMasterPassword();
    this.showMasterPasswordOnClientRestartOption = hasMasterPassword;

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

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
      pin: await this.pinService.isPinSet(activeAccount.id),
      pinLockWithMasterPassword:
        (await this.pinService.getPinLockType(activeAccount.id)) == "AfterFirstUnlock",
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(activeAccount.id),
      enableAutoBiometricsPrompt: await firstValueFrom(
        this.biometricStateService.promptAutomatically$(activeAccount.id),
      ),
      enablePhishingDetection: await firstValueFrom(this.phishingDetectionSettingsService.enabled$),
      allowSharingUnlockStateWithDesktop: await firstValueFrom(
        this.sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$(activeAccount.id),
      ),
      allowSharingUnlockStateWithWeb: await firstValueFrom(
        this.sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$(activeAccount.id),
      ),
    };
    this.form.patchValue(initialValues, { emitEvent: false });
    this.loading.set(false);

    this.showChangeMasterPass = await this.userVerificationService.hasMasterPassword();

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
          await this.pinService.setPin(
            pin,
            value ? "AfterFirstUnlock" : "BeforeFirstUnlock",
            userId,
          );
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
          await this.biometricStateService.setPromptAutomatically(enabled, activeAccount.id);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.enablePhishingDetection.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
          await this.phishingDetectionSettingsService.setEnabled(userId, enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.allowSharingUnlockStateWithDesktop.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateAllowSharingUnlockStateWithDesktop(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.allowSharingUnlockStateWithWeb.valueChanges
      .pipe(
        concatMap(async (enabled) => {
          await this.updateAllowSharingUnlockStateWithWeb(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    await this.promptForDesktopSharingPermissionIfNeeded();
    // Note: This will be removed after shared unlock is rolled out
    await this.promptForBiometricPermissionIfNeeded();
  }

  /**
   * When the Account Security page was popped out specifically to enable desktop unlock sharing
   * (signalled by the `autoRequestDesktopSharing` query param), continue the flow that was started
   * in the popup. Enabling the form control triggers `updateAllowSharingUnlockStateWithDesktop`,
   * which — now running in the popout — presents the permission dialog and requests the
   * `nativeMessaging` permission.
   */
  private async promptForDesktopSharingPermissionIfNeeded() {
    if (
      !BrowserPopupUtils.inPopout(window) ||
      this.route.snapshot.queryParamMap.get("autoRequestDesktopSharing") !== "true" ||
      (await BrowserApi.permissionsGranted(["nativeMessaging"]))
    ) {
      return;
    }

    this.form.controls.allowSharingUnlockStateWithDesktop.setValue(true);
  }

  /**
   * When the Account Security page was popped out specifically to enable biometric unlock
   * (signalled by the `autoRequestBiometrics` query param), continue the flow that was started
   * in the popup. Enabling the form control triggers `updateBiometric`, which — now running in
   * the popout — presents the permission dialog and requests the `nativeMessaging` permission.
   * @deprecated This will be removed after shared unlock is rolled out
   */
  private async promptForBiometricPermissionIfNeeded() {
    if (
      !BrowserPopupUtils.inPopout(window) ||
      this.route.snapshot.queryParamMap.get("autoRequestBiometrics") !== "true" ||
      (await BrowserApi.permissionsGranted(["nativeMessaging"]))
    ) {
      return;
    }

    this.form.controls.biometric.setValue(true);
  }

  protected async dismissAccountSecurityNudge() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      return;
    }
    await this.vaultNudgesService.dismissNudge(NudgeType.AccountSecurity, activeAccount.id);
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
      const requireReprompt = (await this.pinService.getPinLockType(userId)) == "AfterFirstUnlock";
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

  /**
   * @deprecated This will be removed after shared unlock is rolled out
   */
  async updateBiometric(enabled: boolean) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (enabled) {
      const hadPermission = await BrowserApi.permissionsGranted(["nativeMessaging"]);
      if (!hadPermission) {
        if (!BrowserPopupUtils.inPopout(window)) {
          // Requesting the permission outside a popout would close the window (granting reloads
          // the extension), so pop out to a stable window. The popped-out window presents the
          // dialog and requests the permission. With hash routing, Angular reads query params
          // from after the hash route.
          const url = new URL(window.location.href);
          url.hash += (url.hash.includes("?") ? "&" : "?") + "autoRequestBiometrics=true";
          await BrowserPopupUtils.openCurrentPagePopout(window, url.href);
          return;
        }

        // In the popout, the dialog explains what enabling biometric unlock entails and requests
        // the nativeMessaging permission. It closes with `true` when the permission was granted.
        const granted = await firstValueFrom(
          NativeMessagingPermissionDialogComponent.open(this.dialogService, {
            type: NativeMessagingPermissionDialogType.Biometrics,
          }).closed,
        );
        if (!granted) {
          this.form.controls.biometric.setValue(false, { emitEvent: false });
          return;
        }
      }

      await this.biometricStateService.setBiometricUnlockEnabled(true, userId);

      if (!hadPermission) {
        // The nativeMessaging permission was just granted. The extension must reload to register
        // the native messaging host. State is saved above so it survives the reload. The
        // background performs the reload once all popups/popouts have closed; this popout won't
        // receive its own broadcast, so close it explicitly to unblock that reload.
        this.messagingService.send("reloadExtension");
        await BrowserPopupUtils.closeCurrentPopupOrPopout(window);
      }
    } else {
      await this.biometricStateService.setBiometricUnlockEnabled(false, userId);
      await this.biometricStateService.setFingerprintValidated(false);
    }
  }

  async updateAllowSharingUnlockStateWithDesktop(enabled: boolean) {
    const hadPermission = await BrowserApi.permissionsGranted(["nativeMessaging"]);
    if (enabled && !hadPermission) {
      if (!BrowserPopupUtils.inPopout(window)) {
        // Requesting the permission outside a popout would close the window (granting reloads the
        // extension), so pop out to a stable window. The popped-out window presents the dialog and
        // requests the permission. With hash routing, Angular reads query params from after the
        // hash route.
        const url = new URL(window.location.href);
        url.hash += (url.hash.includes("?") ? "&" : "?") + "autoRequestDesktopSharing=true";
        await BrowserPopupUtils.openCurrentPagePopout(window, url.href);
        return;
      }

      // In the popout, the dialog explains what enabling desktop sharing entails and requests the
      // nativeMessaging permission. It closes with `true` when the permission was granted.
      const granted = await firstValueFrom(
        NativeMessagingPermissionDialogComponent.open(this.dialogService, {
          type: NativeMessagingPermissionDialogType.SharedUnlock,
        }).closed,
      );
      if (!granted) {
        this.form.controls.allowSharingUnlockStateWithDesktop.setValue(false, { emitEvent: false });
        return;
      }
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop(enabled, userId);
    if (!enabled && !this.form.controls.allowSharingUnlockStateWithWeb.value) {
      await this.vaultTimeoutSettingsService.clearVaultTimeoutSuppression(userId);
    }

    if (enabled && !hadPermission) {
      // The nativeMessaging permission was just granted. The extension must reload to register
      // the native messaging host. State is saved above so it survives the reload. The background
      // performs the reload once all popups/popouts have closed; this popout won't receive its own
      // broadcast, so close it explicitly to unblock that reload.
      this.messagingService.send("reloadExtension");
      await BrowserPopupUtils.closeCurrentPopupOrPopout(window);
    }
  }

  async updateAllowSharingUnlockStateWithWeb(enabled: boolean) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.sharedUnlockSettingsService.setAllowSharingUnlockStateWithWeb(enabled, userId);
    if (!enabled && !this.form.controls.allowSharingUnlockStateWithDesktop.value) {
      await this.vaultTimeoutSettingsService.clearVaultTimeoutSuppression(userId);
    }
  }

  async updateAutoBiometricsPrompt() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.biometricStateService.setPromptAutomatically(
      this.form.value.enableAutoBiometricsPrompt,
      userId,
    );
  }

  async changePassword() {
    const multiClientPasswordManagementFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM32413_MultiClientPasswordManagement,
    );

    if (multiClientPasswordManagementFlagEnabled) {
      await this.router.navigate(["/" + AuthExtensionRoute.SettingsPassword]);
      return;
    }

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
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.lockService.lock(activeUserId);
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
