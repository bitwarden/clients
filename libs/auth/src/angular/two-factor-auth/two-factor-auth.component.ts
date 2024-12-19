// TODO: ensure this file is type safe and remove ts-strict-ignore before PR
// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { lastValueFrom, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";

import { TwoFactorAuthAuthenticatorComponent } from "./child-components/two-factor-auth-authenticator.component";
import { TwoFactorAuthDuoComponent } from "./child-components/two-factor-auth-duo/two-factor-auth-duo.component";
import { TwoFactorAuthEmailComponent } from "./child-components/two-factor-auth-email/two-factor-auth-email.component";
import { TwoFactorAuthWebAuthnComponent } from "./child-components/two-factor-auth-webauthn.component";
import { TwoFactorAuthYubikeyComponent } from "./child-components/two-factor-auth-yubikey.component";
import {
  LegacyKeyMigrationAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";
import {
  TwoFactorOptionsDialogResult,
  TwoFactorOptionsComponent,
  TwoFactorOptionsDialogResultType,
} from "./two-factor-options.component";

@Component({
  standalone: true,
  selector: "app-two-factor-auth",
  templateUrl: "two-factor-auth.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    RouterLink,
    ButtonModule,
    TwoFactorOptionsComponent, // used as dialog
    TwoFactorAuthAuthenticatorComponent,
    TwoFactorAuthEmailComponent,
    TwoFactorAuthDuoComponent,
    TwoFactorAuthYubikeyComponent,
    TwoFactorAuthWebAuthnComponent,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthComponent implements OnInit, OnDestroy {
  token = "";
  remember = false;
  orgSsoIdentifier: string = null;
  inSsoFlow = false;

  providers = TwoFactorProviders;
  providerType = TwoFactorProviderType;
  selectedProviderType: TwoFactorProviderType = TwoFactorProviderType.Authenticator;
  providerData: { [key: string]: string }; // TODO: build more specific type

  @ViewChild("duoComponent") duoComponent!: TwoFactorAuthDuoComponent;

  form = this.formBuilder.group({
    token: [
      "",
      {
        validators: [Validators.required],
        updateOn: "submit",
      },
    ],
    remember: [false],
  });

  title = "";

  formPromise: Promise<any>;

  submitForm = async () => {
    await this.submit();
  };

  private twoFactorSessionTimeoutRoute = "2fa-timeout";

  constructor(
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private router: Router,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private logService: LogService,
    private twoFactorService: TwoFactorService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    @Inject(WINDOW) protected win: Window,
    private toastService: ToastService,
    private twoFactorAuthComponentService: TwoFactorAuthComponentService,
    private syncService: SyncService,
    private messagingService: MessagingService,
  ) {}

  async ngOnInit() {
    this.inSsoFlow = this.activatedRoute.snapshot.queryParamMap.get("sso") === "true";
    this.orgSsoIdentifier = this.activatedRoute.snapshot.queryParamMap.get("identifier");
    this.listenFor2faSessionTimeout();

    if (this.twoFactorAuthComponentService.shouldCheckForWebauthnResponseOnInit()) {
      await this.processWebAuthnResponseIfExists();
    }

    await this.setSelected2faProviderType();
    await this.set2faProviderData();
    await this.setTitleByTwoFactorProviderType();

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.token = value.token;
      this.remember = value.remember;
    });

    await this.twoFactorAuthComponentService.extendPopupWidthIfRequired?.(
      this.selectedProviderType,
    );
  }

  private async processWebAuthnResponseIfExists() {
    const webAuthn2faResponse = this.activatedRoute.snapshot.queryParamMap.get("webAuthnResponse");
    if (webAuthn2faResponse) {
      this.selectedProviderType = TwoFactorProviderType.WebAuthn;
      await this.set2faProviderData();
      this.token = webAuthn2faResponse;
      this.remember = this.activatedRoute.snapshot.queryParamMap.get("remember") === "true";
      await this.submit();
    }
  }

  private async setSelected2faProviderType() {
    const webAuthnSupported = this.platformUtilsService.supportsWebAuthn(this.win);
    this.selectedProviderType = await this.twoFactorService.getDefaultProvider(webAuthnSupported);
  }

  private async set2faProviderData() {
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(this.selectedProviderType);
    });
    this.providerData = providerData;
  }

  private listenFor2faSessionTimeout() {
    this.loginStrategyService.twoFactorTimeout$
      .pipe(takeUntilDestroyed())
      .subscribe(async (expired) => {
        if (!expired) {
          return;
        }

        try {
          await this.router.navigate([this.twoFactorSessionTimeoutRoute]);
        } catch (err) {
          this.logService.error(
            `Failed to navigate to ${this.twoFactorSessionTimeoutRoute} route`,
            err,
          );
        }
      });
  }

  async submit() {
    if (this.token == null || this.token === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verificationCodeRequired"),
      });
      return;
    }

    try {
      this.formPromise = this.loginStrategyService.logInTwoFactor(
        new TokenTwoFactorRequest(this.selectedProviderType, this.token, this.remember),
        null,
      );
      const authResult: AuthResult = await this.formPromise;
      this.logService.info("Successfully submitted two factor token");
      await this.handleAuthResult(authResult);
    } catch {
      this.logService.error("Error submitting two factor token");
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidVerificationCode"),
      });
    }
  }

  async selectOtherTwofactorMethod() {
    const dialogRef = TwoFactorOptionsComponent.open(this.dialogService);
    const response: TwoFactorOptionsDialogResultType = await lastValueFrom(dialogRef.closed);
    if (response.result === TwoFactorOptionsDialogResult.Provider) {
      const providerData = await this.twoFactorService.getProviders().then((providers) => {
        return providers.get(response.type);
      });
      this.providerData = providerData;
      this.selectedProviderType = response.type;
      await this.setTitleByTwoFactorProviderType();
    }
  }

  async launchDuo() {
    if (this.duoComponent != null) {
      await this.duoComponent.launchDuoFrameless();
    }
  }

  protected async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    // Migration is forced so prevent login via return
    const legacyKeyMigrationAction: LegacyKeyMigrationAction =
      this.twoFactorAuthComponentService.determineLegacyKeyMigrationAction();

    switch (legacyKeyMigrationAction) {
      case LegacyKeyMigrationAction.NAVIGATE_TO_MIGRATION_COMPONENT:
        await this.router.navigate(["migrate-legacy-encryption"]);
        break;
      case LegacyKeyMigrationAction.PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING:
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccured"),
          message: this.i18nService.t("encryptionKeyMigrationRequired"),
        });
        break;
    }
    return true;
  }

  async setTitleByTwoFactorProviderType() {
    if (this.selectedProviderType == null) {
      this.title = this.i18nService.t("loginUnavailable");
      return;
    }

    this.title = (TwoFactorProviders as any)[this.selectedProviderType].name;
  }

  private async handleAuthResult(authResult: AuthResult) {
    if (await this.handleMigrateEncryptionKey(authResult)) {
      return; // stop login process
    }

    // User is fully logged in so handle any post login logic before executing navigation
    await this.syncService.fullSync(true);
    this.loginEmailService.clearValues();

    // Save off the OrgSsoIdentifier for use in the TDE flows
    // - TDE login decryption options component
    // - Browser SSO on extension open
    await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(this.orgSsoIdentifier);

    // note: this flow affects both TDE & standard users
    if (this.isForcePasswordResetRequired(authResult)) {
      return await this.handleForcePasswordReset(this.orgSsoIdentifier);
    }

    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );

    const tdeEnabled = await this.isTrustedDeviceEncEnabled(userDecryptionOpts.trustedDeviceOption);

    if (tdeEnabled) {
      return await this.handleTrustedDeviceEncryptionEnabled(userDecryptionOpts);
    }

    // User must set password if they don't have one and they aren't using either TDE or key connector.
    const requireSetPassword =
      !userDecryptionOpts.hasMasterPassword && userDecryptionOpts.keyConnectorOption === undefined;

    if (requireSetPassword || authResult.resetMasterPassword) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(this.orgSsoIdentifier);
    }

    // if we are in the SSO flow and we have a custom success handler, call it
    if (
      this.inSsoFlow &&
      this.twoFactorAuthComponentService.handleSso2faFlowSuccess !== undefined
    ) {
      await this.twoFactorAuthComponentService.handleSso2faFlowSuccess();
      return;
    }

    // TODO: test extension + webauthn 2fa to ensure these calls are no longer necessary:
    // this.onSuccessfulLogin = async () => {
    //   this.messagingService.send("reloadPopup"); // this is just a navigate to "/"
    //   window.close();
    // };

    const defaultSuccessRoute = await this.determineDefaultSuccessRoute();

    await this.router.navigate([defaultSuccessRoute], {
      queryParams: {
        identifier: this.orgSsoIdentifier,
      },
    });
  }

  private async determineDefaultSuccessRoute(): Promise<string> {
    const authType = await firstValueFrom(this.loginStrategyService.currentAuthType$);
    if (authType == AuthenticationType.Sso || authType == AuthenticationType.UserApiKey) {
      return "lock";
    }

    return "vault";
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption,
  ): Promise<boolean> {
    const ssoTo2faFlowActive = this.activatedRoute.snapshot.queryParamMap.get("sso") === "true";

    return ssoTo2faFlowActive && trustedDeviceOption !== undefined;
  }

  private async handleTrustedDeviceEncryptionEnabled(
    userDecryptionOpts: UserDecryptionOptions,
  ): Promise<void> {
    // If user doesn't have a MP, but has reset password permission, they must set a MP
    if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption.hasManageResetPasswordPermission
    ) {
      // Set flag so that auth guard can redirect to set password screen after decryption (trusted or untrusted device)
      // Note: we cannot directly navigate to the set password screen in this scenario as we are in a pre-decryption state, and
      // if you try to set a new MP before decrypting, you will invalidate the user's data by making a new user key.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }

    // TODO: determine why this is necessary?
    if (this.twoFactorAuthComponentService.closeWindow !== undefined) {
      this.twoFactorAuthComponentService.closeWindow();
      return;
    }

    await this.router.navigate(["login-initiated"]);
  }

  private async handleChangePasswordRequired(orgIdentifier: string) {
    await this.router.navigate(["set-password"], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  /**
   * Determines if a user needs to reset their password based on certain conditions.
   * Users can be forced to reset their password via an admin or org policy disallowing weak passwords.
   * Note: this is different from the SSO component login flow as a user can
   * login with MP and then have to pass 2FA to finish login and we can actually
   * evaluate if they have a weak password at that time.
   *
   * @param {AuthResult} authResult - The authentication result.
   * @returns {boolean} Returns true if a password reset is required, false otherwise.
   */
  private isForcePasswordResetRequired(authResult: AuthResult): boolean {
    const forceResetReasons = [
      ForceSetPasswordReason.AdminForcePasswordReset,
      ForceSetPasswordReason.WeakMasterPassword,
    ];

    return forceResetReasons.includes(authResult.forcePasswordReset);
  }

  private async handleForcePasswordReset(orgIdentifier: string) {
    await this.router.navigate(["update-temp-password"], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  showContinueButton() {
    return (
      this.selectedProviderType != null &&
      this.selectedProviderType !== TwoFactorProviderType.WebAuthn &&
      this.selectedProviderType !== TwoFactorProviderType.Duo &&
      this.selectedProviderType !== TwoFactorProviderType.OrganizationDuo
    );
  }

  async ngOnDestroy() {
    this.twoFactorAuthComponentService.removePopupWidthExtension?.();
  }
}
