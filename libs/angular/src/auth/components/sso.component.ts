import { Directive } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { SsoLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { TrustedDeviceUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/trusted-device-user-decryption-option";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { AccountDecryptionOptions } from "@bitwarden/common/platform/models/domain/account";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

@Directive()
export class SsoComponent {
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
  protected changePasswordRoute = "set-password";
  protected forcePasswordResetRoute = "update-temp-password";
  protected clientId: string;
  protected redirectUri: string;
  protected state: string;
  protected codeChallenge: string;

  constructor(
    protected authService: AuthService,
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
    protected configService: ConfigServiceAbstraction
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.code != null && qParams.state != null) {
        const codeVerifier = await this.stateService.getSsoCodeVerifier();
        const state = await this.stateService.getSsoState();
        await this.stateService.setSsoCodeVerifier(null);
        await this.stateService.setSsoState(null);
        if (
          qParams.code != null &&
          codeVerifier != null &&
          state != null &&
          this.checkState(state, qParams.state)
        ) {
          // We are not using a query param to pass org identifier around specifically
          // for the browser SSO case when it needs it on extension open after SSO success
          // on the TDE login decryption options component
          const ssoOrganizationIdentifier = this.getOrgIdentifierFromState(qParams.state);
          await this.logIn(qParams.code, codeVerifier, ssoOrganizationIdentifier);
          await this.stateService.setUserSsoOrganizationIdentifier(ssoOrganizationIdentifier);
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
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("ssoValidationFailed"),
        this.i18nService.t("ssoIdentifierRequired")
      );
      return;
    }

    this.initiateSsoFormPromise = this.apiService.preValidateSso(this.identifier);
    const response = await this.initiateSsoFormPromise;

    const authorizeUrl = await this.buildAuthorizeUrl(
      returnUri,
      includeUserIdentifier,
      response.token
    );
    this.platformUtilsService.launchUri(authorizeUrl, { sameWindow: true });
  }

  protected async buildAuthorizeUrl(
    returnUri?: string,
    includeUserIdentifier?: boolean,
    token?: string
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
      await this.stateService.setSsoCodeVerifier(codeVerifier);
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
    await this.stateService.setSsoState(state);

    let authorizeUrl =
      this.environmentService.getIdentityUrl() +
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

  private async logIn(code: string, codeVerifier: string, orgIdentifier: string) {
    this.loggingIn = true;
    try {
      const credentials = new SsoLogInCredentials(
        code,
        codeVerifier,
        this.redirectUri,
        orgIdentifier
      );
      this.formPromise = this.authService.logIn(credentials);
      const authResult = await this.formPromise;

      const acctDecryptionOpts: AccountDecryptionOptions =
        await this.stateService.getAccountDecryptionOptions();

      if (authResult.requiresTwoFactor) {
        return await this.handleTwoFactorRequired(orgIdentifier);
      }

      const tdeEnabled = await this.isTrustedDeviceEncEnabled(
        acctDecryptionOpts.trustedDeviceOption
      );

      if (tdeEnabled) {
        return await this.handleTrustedDeviceEncryptionEnabled(
          authResult,
          orgIdentifier,
          acctDecryptionOpts
        );
      }

      // In the standard, non TDE case, a user must set password if they don't
      // have one and they aren't using key connector.
      // Note: TDE & Key connector are mutually exclusive org config options.
      const requireSetPassword =
        !acctDecryptionOpts.hasMasterPassword &&
        acctDecryptionOpts.keyConnectorOption === undefined;

      if (requireSetPassword || authResult.resetMasterPassword) {
        // Change implies going no password -> password in this case
        return await this.handleChangePasswordRequired(orgIdentifier);
      }

      // Users enrolled in admin acct recovery can be forced to set a new password after
      // having the admin set a temp password for them
      if (authResult.forcePasswordReset == ForceResetPasswordReason.AdminForcePasswordReset) {
        return await this.handleForcePasswordReset(orgIdentifier);
      }

      // Standard SSO login success case
      return await this.handleSuccessfulLogin();
    } catch (e) {
      await this.handleLoginError(e);
    }
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption
  ): Promise<boolean> {
    const trustedDeviceEncryptionFeatureActive = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.TrustedDeviceEncryption
    );

    return trustedDeviceEncryptionFeatureActive && trustedDeviceOption !== undefined;
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
      }
    );
  }

  private async handleTrustedDeviceEncryptionEnabled(
    authResult: AuthResult,
    orgIdentifier: string,
    acctDecryptionOpts: AccountDecryptionOptions
  ): Promise<void> {
    // If user doesn't have a MP, but has reset password permission, they must set a MP
    if (
      !acctDecryptionOpts.hasMasterPassword &&
      acctDecryptionOpts.trustedDeviceOption.hasManageResetPasswordPermission
    ) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(orgIdentifier);
    }

    if (authResult.forcePasswordReset !== ForceResetPasswordReason.None) {
      return await this.handleForcePasswordReset(orgIdentifier);
    }

    if (this.onSuccessfulLoginTde != null) {
      // Don't await b/c causes hang on desktop & browser
      this.onSuccessfulLoginTde();
    }

    this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginTdeNavigate,
      // Navigate to TDE page (if user was on trusted device and TDE has decrypted
      //  their user key, the login-initiated guard will redirect them to the vault)
      [this.trustedDeviceEncRoute]
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
      }
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
      }
    );
  }

  private async handleSuccessfulLogin() {
    if (this.onSuccessfulLogin != null) {
      // Don't await b/c causes hang on desktop & browser
      this.onSuccessfulLogin();
    }

    await this.navigateViaCallbackOrRoute(this.onSuccessfulLoginNavigate, [this.successRoute]);
  }

  private async handleLoginError(e: any) {
    this.logService.error(e);

    // TODO: Key Connector Service should pass this error message to the logout callback instead of displaying here
    if (e.message === "Key Connector error") {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("ssoKeyConnectorError")
      );
    }
  }

  private async navigateViaCallbackOrRoute(
    callback: () => Promise<unknown>,
    commands: unknown[],
    extras?: NavigationExtras
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
