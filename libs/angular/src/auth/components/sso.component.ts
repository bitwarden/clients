// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import {
  LoginStrategyServiceAbstraction,
  SsoLoginCredentials,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

@Directive()
export class SsoComponent implements OnInit {
  identifier: string;
  loggingIn = false;

  formPromise: Promise<AuthResult>;
  initiateSsoFormPromise: Promise<SsoPreValidateResponse>;
  onSuccessfulLogin: () => Promise<void>;
  onSuccessfulLoginNavigate: () => Promise<void>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<void>;
  onSuccessfulLoginChangePasswordNavigate: () => Promise<void>;
  onSuccessfulLoginForceResetNavigate: () => Promise<void>;

  onSuccessfulLoginTde: () => Promise<void>;
  onSuccessfulLoginTdeNavigate: () => Promise<void>;

  protected twoFactorRoute = "2fa";
  protected successRoute = "lock";
  protected trustedDeviceEncRoute = "login-initiated";
  protected changePasswordRoute = "set-password-jit";
  protected forcePasswordResetRoute = "update-temp-password";
  protected clientId: string;
  protected redirectUri: string;
  protected state: string;
  protected codeChallenge: string;

  constructor(
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected router: Router,
    protected i18nService: I18nService,
    protected route: ActivatedRoute,
    protected stateService: StateService,
    protected platformUtilsService: PlatformUtilsService,
    protected apiService: ApiService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected logService: LogService,
    protected userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    protected configService: ConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected accountService: AccountService,
    protected toastService: ToastService,
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.code != null && qParams.state != null) {
        const codeVerifier = await this.ssoLoginService.getCodeVerifier();
        const state = await this.ssoLoginService.getSsoState();
        await this.ssoLoginService.setCodeVerifier(null);
        await this.ssoLoginService.setSsoState(null);

        if (qParams.redirectUri != null) {
          this.redirectUri = qParams.redirectUri;
        }

        if (
          qParams.code != null &&
          codeVerifier != null &&
          state != null &&
          this.checkState(state, qParams.state)
        ) {
          const ssoOrganizationIdentifier = this.getOrgIdentifierFromState(qParams.state);
          await this.logIn(qParams.code, codeVerifier, ssoOrganizationIdentifier);
        }
      } else if (
        qParams.clientId != null &&
        qParams.redirectUri != null &&
        qParams.state != null &&
        qParams.codeChallenge != null
      ) {
        this.redirectUri = qParams.redirectUri;
        this.state = qParams.state;
        this.codeChallenge = qParams.codeChallenge;
        this.clientId = qParams.clientId;
      }
    });
  }

  async submit(returnUri?: string, includeUserIdentifier?: boolean) {
    if (this.identifier == null || this.identifier === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("ssoValidationFailed"),
        message: this.i18nService.t("ssoIdentifierRequired"),
      });
      return;
    }

    this.initiateSsoFormPromise = this.apiService.preValidateSso(this.identifier);
    const response = await this.initiateSsoFormPromise;

    const authorizeUrl = await this.buildAuthorizeUrl(
      returnUri,
      includeUserIdentifier,
      response.token,
    );
    this.platformUtilsService.launchUri(authorizeUrl, { sameWindow: true });
  }

  protected async buildAuthorizeUrl(
    returnUri?: string,
    includeUserIdentifier?: boolean,
    token?: string,
  ): Promise<string> {
    let codeChallenge = this.codeChallenge;
    let state = this.state;

    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    if (codeChallenge == null) {
      const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
      const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
      codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);
      await this.ssoLoginService.setCodeVerifier(codeVerifier);
    }

    if (state == null) {
      state = await this.passwordGenerationService.generatePassword(passwordOptions);
      if (returnUri) {
        state += `_returnUri='${returnUri}'`;
      }
    }

    // Add Organization Identifier to state
    state += `_identifier=${this.identifier}`;

    // Save state (regardless of new or existing)
    await this.ssoLoginService.setSsoState(state);

    const env = await firstValueFrom(this.environmentService.environment$);

    let authorizeUrl =
      env.getIdentityUrl() +
      "/connect/authorize?" +
      "client_id=" +
      this.clientId +
      "&redirect_uri=" +
      encodeURIComponent(this.redirectUri) +
      "&" +
      "response_type=code&scope=api offline_access&" +
      "state=" +
      state +
      "&code_challenge=" +
      codeChallenge +
      "&" +
      "code_challenge_method=S256&response_mode=query&" +
      "domain_hint=" +
      encodeURIComponent(this.identifier) +
      "&ssoToken=" +
      encodeURIComponent(token);

    if (includeUserIdentifier) {
      const userIdentifier = await this.apiService.getSsoUserIdentifier();
      authorizeUrl += `&user_identifier=${encodeURIComponent(userIdentifier)}`;
    }

    return authorizeUrl;
  }

  private async logIn(code: string, codeVerifier: string, orgSsoIdentifier: string): Promise<void> {
    this.loggingIn = true;
    try {
      const email = await this.ssoLoginService.getSsoEmail();

      const credentials = new SsoLoginCredentials(
        code,
        codeVerifier,
        this.redirectUri,
        orgSsoIdentifier,
        email,
      );
      this.formPromise = this.loginStrategyService.logIn(credentials);
      const authResult = await this.formPromise;

      if (authResult.requiresTwoFactor) {
        return await this.handleTwoFactorRequired(orgSsoIdentifier);
      }

      // Everything after the 2FA check is considered a successful login
      // Just have to figure out where to send the user

      // Save off the OrgSsoIdentifier for use in the TDE flows (or elsewhere)
      // - TDE login decryption options component
      // - Browser SSO on extension open
      // Note: you cannot set this in state before 2FA b/c there won't be an account in state.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(orgSsoIdentifier, userId);

      // Users enrolled in admin acct recovery can be forced to set a new password after
      // having the admin set a temp password for them (affects TDE & standard users)
      if (authResult.forcePasswordReset == ForceSetPasswordReason.AdminForcePasswordReset) {
        // Weak password is not a valid scenario here b/c we cannot have evaluated a MP yet
        return await this.handleForcePasswordReset(orgSsoIdentifier);
      }

      // must come after 2fa check since user decryption options aren't available if 2fa is required
      const userDecryptionOpts = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptions$,
      );

      const tdeEnabled = await this.isTrustedDeviceEncEnabled(
        userDecryptionOpts.trustedDeviceOption,
      );

      if (tdeEnabled) {
        return await this.handleTrustedDeviceEncryptionEnabled(
          authResult,
          orgSsoIdentifier,
          userDecryptionOpts,
        );
      }

      // In the standard, non TDE case, a user must set password if they don't
      // have one and they aren't using key connector.
      // Note: TDE & Key connector are mutually exclusive org config options.
      const requireSetPassword =
        !userDecryptionOpts.hasMasterPassword &&
        userDecryptionOpts.keyConnectorOption === undefined;

      if (requireSetPassword || authResult.resetMasterPassword) {
        // Change implies going no password -> password in this case
        return await this.handleChangePasswordRequired(orgSsoIdentifier);
      }

      // Standard SSO login success case
      return await this.handleSuccessfulLogin();
    } catch (e) {
      await this.handleLoginError(e);
    }
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption,
  ): Promise<boolean> {
    return trustedDeviceOption !== undefined;
  }

  private async handleTwoFactorRequired(orgIdentifier: string) {
    await this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginTwoFactorNavigate,
      [this.twoFactorRoute],
      {
        queryParams: {
          identifier: orgIdentifier,
          sso: "true",
        },
      },
    );
  }

  private async handleTrustedDeviceEncryptionEnabled(
    authResult: AuthResult,
    orgIdentifier: string,
    userDecryptionOpts: UserDecryptionOptions,
  ): Promise<void> {
    // Tde offboarding takes precedence
    if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption.isTdeOffboarding
    ) {
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeOffboarding,
        userId,
      );
    } else if (
      // If user doesn't have a MP, but has reset password permission, they must set a MP
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption.hasManageResetPasswordPermission
    ) {
      // Set flag so that auth guard can redirect to set password screen after decryption (trusted or untrusted device)
      // Note: we cannot directly navigate in this scenario as we are in a pre-decryption state, and
      // if you try to set a new MP before decrypting, you will invalidate the user's data by making a new user key.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }

    if (this.onSuccessfulLoginTde != null) {
      // Don't await b/c causes hang on desktop & browser
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onSuccessfulLoginTde();
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginTdeNavigate,
      // Navigate to TDE page (if user was on trusted device and TDE has decrypted
      //  their user key, the login-initiated guard will redirect them to the vault)
      [this.trustedDeviceEncRoute],
    );
  }

  private async handleChangePasswordRequired(orgIdentifier: string) {
    await this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginChangePasswordNavigate,
      [this.changePasswordRoute],
      {
        queryParams: {
          identifier: orgIdentifier,
        },
      },
    );
  }

  private async handleForcePasswordReset(orgIdentifier: string) {
    await this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginForceResetNavigate,
      [this.forcePasswordResetRoute],
      {
        queryParams: {
          identifier: orgIdentifier,
        },
      },
    );
  }

  private async handleSuccessfulLogin() {
    if (this.onSuccessfulLogin != null) {
      // Don't await b/c causes hang on desktop & browser
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onSuccessfulLogin();
    }

    await this.navigateViaCallbackOrRoute(this.onSuccessfulLoginNavigate, [this.successRoute]);
  }

  private async handleLoginError(e: any) {
    this.logService.error(e);

    // TODO: Key Connector Service should pass this error message to the logout callback instead of displaying here
    if (e.message === "Key Connector error") {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("ssoKeyConnectorError"),
      });
    }
  }

  private async navigateViaCallbackOrRoute(
    callback: () => Promise<unknown>,
    commands: unknown[],
    extras?: NavigationExtras,
  ): Promise<void> {
    if (callback) {
      await callback();
    } else {
      await this.router.navigate(commands, extras);
    }
  }

  private getOrgIdentifierFromState(state: string): string {
    if (state === null || state === undefined) {
      return null;
    }

    const stateSplit = state.split("_identifier=");
    return stateSplit.length > 1 ? stateSplit[1] : null;
  }

  private checkState(state: string, checkState: string): boolean {
    if (state === null || state === undefined) {
      return false;
    }
    if (checkState === null || checkState === undefined) {
      return false;
    }

    const stateSplit = state.split("_identifier=");
    const checkStateSplit = checkState.split("_identifier=");
    return stateSplit[0] === checkStateSplit[0];
  }
}
