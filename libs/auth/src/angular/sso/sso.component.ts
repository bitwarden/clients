import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginStrategyServiceAbstraction,
  SsoLoginCredentials,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainSsoDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain-sso-details.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/verified-organization-domain-sso-details.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { SsoClientType, SsoComponentService } from "./sso-component.service";

interface QueryParams {
  code?: string;
  state?: string;
  redirectUri?: string;
  clientId?: string;
  codeChallenge?: string;
  identifier?: string;
  email?: string;
}

/**
 * This component handles the SSO flow.
 */
@Component({
  standalone: true,
  templateUrl: "sso.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    IconButtonModule,
    LinkModule,
    JslibModule,
    ReactiveFormsModule,
    RouterModule,
  ],
})
export class SsoComponent implements OnInit {
  protected formGroup = new FormGroup({
    identifier: new FormControl<string | null>(null, [Validators.required]),
  });

  protected redirectUri: string | undefined;
  protected loggingIn = false;
  protected identifier: string | undefined;
  protected state: string | undefined;
  protected codeChallenge: string | undefined;
  protected clientId: SsoClientType | undefined;

  formPromise: Promise<AuthResult> | undefined;
  initiateSsoFormPromise: Promise<SsoPreValidateResponse> | undefined;

  get identifierFormControl() {
    return this.formGroup.controls.identifier;
  }

  constructor(
    private ssoLoginService: SsoLoginServiceAbstraction,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private router: Router,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private orgDomainApiService: OrgDomainApiServiceAbstraction,
    private validationService: ValidationService,
    private configService: ConfigService,
    private platformUtilsService: PlatformUtilsService,
    private apiService: ApiService,
    private cryptoFunctionService: CryptoFunctionService,
    private environmentService: EnvironmentService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private logService: LogService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private accountService: AccountService,
    private toastService: ToastService,
    private ssoComponentService: SsoComponentService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
  ) {
    environmentService.environment$.pipe(takeUntilDestroyed()).subscribe((env) => {
      this.redirectUri = env.getWebVaultUrl() + "/sso-connector.html";
    });

    const clientType = this.platformUtilsService.getClientType();
    if (this.isValidSsoClientType(clientType)) {
      this.clientId = clientType as SsoClientType;
    }
  }

  async ngOnInit() {
    const qParams: QueryParams = await firstValueFrom(this.route.queryParams);

    // This if statement will pass on the second portion of the SSO flow
    // where the user has already authenticated with the identity provider
    if (this.hasCodeOrStateParams(qParams)) {
      await this.handleCodeAndStateParams(qParams);
      return;
    }

    // This if statement will pass on the first portion of the SSO flow
    if (this.hasRequiredSsoParams(qParams)) {
      this.setRequiredSsoVariables(qParams);
      return;
    }

    if (qParams.identifier != null) {
      // SSO Org Identifier in query params takes precedence over claimed domains
      this.identifierFormControl.setValue(qParams.identifier);
      this.loggingIn = true;
      await this.submit();
      return;
    }

    await this.initializeIdentifierFromEmailOrStorage(qParams);
  }

  /**
   * Sets the required SSO variables from the query params
   * @param qParams - The query params
   */
  private setRequiredSsoVariables(qParams: QueryParams): void {
    this.redirectUri = qParams.redirectUri ?? "";
    this.state = qParams.state ?? "";
    this.codeChallenge = qParams.codeChallenge ?? "";
    const clientId = qParams.clientId ?? "";
    if (this.isValidSsoClientType(clientId)) {
      this.clientId = clientId;
    } else {
      throw new Error(`Invalid SSO client type: ${qParams.clientId}`);
    }
  }

  /**
   * Checks if the value is a valid SSO client type
   * @param value - The value to check
   * @returns True if the value is a valid SSO client type, otherwise false
   */
  private isValidSsoClientType(value: string): value is SsoClientType {
    return [ClientType.Web, ClientType.Browser, ClientType.Desktop].includes(value as ClientType);
  }

  /**
   * Checks if the query params have the required SSO params
   * @param qParams - The query params
   * @returns True if the query params have the required SSO params, false otherwise
   */
  private hasRequiredSsoParams(qParams: QueryParams): boolean {
    return (
      qParams.clientId != null &&
      qParams.redirectUri != null &&
      qParams.state != null &&
      qParams.codeChallenge != null
    );
  }

  /**
   * Handles the code and state params
   * @param qParams - The query params
   */
  private async handleCodeAndStateParams(qParams: QueryParams): Promise<void> {
    const codeVerifier = await this.ssoLoginService.getCodeVerifier();
    const state = await this.ssoLoginService.getSsoState();
    await this.ssoLoginService.setCodeVerifier("");
    await this.ssoLoginService.setSsoState("");

    if (qParams.redirectUri != null) {
      this.redirectUri = qParams.redirectUri;
    }

    if (
      qParams.code != null &&
      codeVerifier != null &&
      state != null &&
      this.checkState(state, qParams.state ?? "")
    ) {
      const ssoOrganizationIdentifier = this.getOrgIdentifierFromState(qParams.state ?? "");
      await this.logIn(qParams.code, codeVerifier, ssoOrganizationIdentifier);
    }
  }

  /**
   * Checks if the query params have a code or state
   * @param qParams - The query params
   * @returns True if the query params have a code or state, false otherwise
   */
  private hasCodeOrStateParams(qParams: QueryParams): boolean {
    return qParams.code != null && qParams.state != null;
  }

  private handleGetClaimedDomainByEmailError(error: unknown): void {
    if (error instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = error as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.NotFound:
          //this is a valid case for a domain not found
          return;

        default:
          this.validationService.showError(errorResponse);
          break;
      }
    }
  }

  submit = async (): Promise<void> => {
    if (this.formGroup.invalid) {
      return;
    }

    const autoSubmit = (await firstValueFrom(this.route.queryParams)).identifier != null;

    this.identifier = this.identifierFormControl.value ?? "";
    await this.ssoLoginService.setOrganizationSsoIdentifier(this.identifier);
    this.ssoComponentService.setDocumentCookies?.();
    try {
      await this.submitSso();
    } catch (error) {
      if (autoSubmit) {
        await this.router.navigate(["/login"]);
      } else {
        this.validationService.showError(error);
      }
    }
  };

  private async submitSso(returnUri?: string, includeUserIdentifier?: boolean) {
    if (this.identifier == null || this.identifier === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("ssoValidationFailed"),
        message: this.i18nService.t("ssoIdentifierRequired"),
      });
      return;
    }

    if (this.clientId == null) {
      throw new Error("Client ID is required");
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

  private async buildAuthorizeUrl(
    returnUri?: string,
    includeUserIdentifier?: boolean,
    token?: string,
  ): Promise<string> {
    let codeChallenge = this.codeChallenge;
    let state = this.state;

    const passwordOptions = {
      type: "password" as const,
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
      encodeURIComponent(this.redirectUri ?? "") +
      "&" +
      "response_type=code&scope=api offline_access&" +
      "state=" +
      state +
      "&code_challenge=" +
      codeChallenge +
      "&" +
      "code_challenge_method=S256&response_mode=query&" +
      "domain_hint=" +
      encodeURIComponent(this.identifier ?? "") +
      "&ssoToken=" +
      encodeURIComponent(token ?? "");

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
      const redirectUri = this.redirectUri ?? "";
      const credentials = new SsoLoginCredentials(
        code,
        codeVerifier,
        redirectUri,
        orgSsoIdentifier,
        email ?? undefined,
      );
      this.formPromise = this.loginStrategyService.logIn(credentials);
      const authResult = await this.formPromise;

      if (authResult.requiresTwoFactor) {
        return await this.handleTwoFactorRequired(orgSsoIdentifier);
      }

      // Everything after the 2FA check is considered a successful login
      // Just have to figure out where to send the user
      await this.loginSuccessHandlerService.run(authResult.userId);

      // Save off the OrgSsoIdentifier for use in the TDE flows (or elsewhere)
      // - TDE login decryption options component
      // - Browser SSO on extension open
      // Note: you cannot set this in state before 2FA b/c there won't be an account in state.

      // Grabbing the active user id right before making the state set to ensure it exists.
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

      const tdeEnabled = userDecryptionOpts.trustedDeviceOption
        ? await this.isTrustedDeviceEncEnabled(userDecryptionOpts.trustedDeviceOption)
        : false;

      if (tdeEnabled) {
        return await this.handleTrustedDeviceEncryptionEnabled(userDecryptionOpts);
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
    await this.router.navigate(["2fa"], {
      queryParams: {
        identifier: orgIdentifier,
        sso: "true",
      },
    });
  }

  private async handleTrustedDeviceEncryptionEnabled(
    userDecryptionOpts: UserDecryptionOptions,
  ): Promise<void> {
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    if (!userId) {
      return;
    }

    // Tde offboarding takes precedence
    if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption?.isTdeOffboarding
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeOffboarding,
        userId,
      );
    } else if (
      // If user doesn't have a MP, but has reset password permission, they must set a MP
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption?.hasManageResetPasswordPermission
    ) {
      // Set flag so that auth guard can redirect to set password screen after decryption (trusted or untrusted device)
      // Note: we cannot directly navigate in this scenario as we are in a pre-decryption state, and
      // if you try to set a new MP before decrypting, you will invalidate the user's data by making a new user key.
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }

    if (this.ssoComponentService?.closeWindow) {
      await this.ssoComponentService.closeWindow();
    } else {
      await this.router.navigate(["login-initiated"]);
    }
  }

  private async handleChangePasswordRequired(orgIdentifier: string) {
    await this.router.navigate(["set-password-jit"], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  private async handleForcePasswordReset(orgIdentifier: string) {
    await this.router.navigate(["update-temp-password"], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  private async handleSuccessfulLogin() {
    await this.router.navigate(["lock"]);
  }

  private async handleLoginError(e: unknown) {
    this.logService.error(e);

    // TODO: Key Connector Service should pass this error message to the logout callback instead of displaying here
    if (e instanceof Error && e.message === "Key Connector error") {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("ssoKeyConnectorError"),
      });
    }
  }

  private getOrgIdentifierFromState(state: string): string {
    if (state === null || state === undefined) {
      return "";
    }

    const stateSplit = state.split("_identifier=");
    return stateSplit.length > 1 ? stateSplit[1] : "";
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

  /**
   * Attempts to initialize the SSO identifier from email or storage.
   * Note: this flow is written for web but both browser and desktop
   * redirect here on SSO button click.
   * @param qParams - The query params
   */
  private async initializeIdentifierFromEmailOrStorage(qParams: QueryParams): Promise<void> {
    // Check if email matches any claimed domains
    if (qParams.email) {
      // show loading spinner
      this.loggingIn = true;
      try {
        if (await this.configService.getFeatureFlag(FeatureFlag.VerifiedSsoDomainEndpoint)) {
          const response: ListResponse<VerifiedOrganizationDomainSsoDetailsResponse> =
            await this.orgDomainApiService.getVerifiedOrgDomainsByEmail(qParams.email);

          if (response.data.length > 0) {
            this.identifierFormControl.setValue(response.data[0].organizationIdentifier);
            await this.submit();
            return;
          }
        } else {
          const response: OrganizationDomainSsoDetailsResponse =
            await this.orgDomainApiService.getClaimedOrgDomainByEmail(qParams.email);

          if (response?.ssoAvailable && response?.verifiedDate) {
            this.identifierFormControl.setValue(response.organizationIdentifier);
            await this.submit();
            return;
          }
        }
      } catch (error) {
        this.handleGetClaimedDomainByEmailError(error);
      }

      this.loggingIn = false;
    }

    // Fallback to state svc if domain is unclaimed
    const storedIdentifier = await this.ssoLoginService.getOrganizationSsoIdentifier();
    if (storedIdentifier != null) {
      this.identifierFormControl.setValue(storedIdentifier);
    }
  }
}
