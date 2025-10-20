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
import { VerifiedOrganizationDomainSsoDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/verified-organization-domain-sso-details.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
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
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
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
  protected email: string | null | undefined;

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
    private keyConnectorService: KeyConnectorService,
  ) {
    environmentService.environment$.pipe(takeUntilDestroyed()).subscribe((env) => {
      this.redirectUri = env.getWebVaultUrl() + "/sso-connector.html";
    });

    const clientType = this.platformUtilsService.getClientType();
    if (this.isValidSsoClientType(clientType)) {
      this.clientId = clientType as SsoClientType;
    }
  }

  /**
   * Like several components in our app (e.g. our invite acceptance components), the SSO component is engaged both
   * before and after the user authenticates.
   * Flow 1: Initialize SSO state and redirect to IdP
   *  - We can get here several ways:
   *    - The user is on the web client and is routed here
   *    - The user is on a different client and is redirected by opening a new browser window, passing query params
   *    - A customer integration has been set up to direct users to the `/sso` route to initiate SSO with an identifier
   * Flow 2: Handle callback from IdP and verify the state that was set pre-authentication
   */
  async ngOnInit() {
    const qParams: QueryParams = await firstValueFrom(this.route.queryParams);

    // SSO on web uses a service to provide the email via state that's set on login,
    // but because we have clients that delegate SSO to web we have to accept the email in the query params as well.
    // We also can't require the email, because it isn't provided in the CLI SSO flow.
    this.email = qParams.email ?? (await this.ssoLoginService.getSsoEmail());

    // Detect if we are on the second portion of the SSO flow,
    // where the user has already authenticated with the identity provider
    if (this.userCompletedSsoAuthentication(qParams)) {
      await this.handleTokenRequestForAuthenticatedUser(qParams);
      return;
    }

    // Detect if we are on the first portion of the SSO flow
    // and have been sent here from another client with the info in query params.
    // If so, we want to initialize the SSO flow with those values.
    if (this.hasParametersFromOtherClientRedirect(qParams)) {
      this.initializeFromRedirectFromOtherClient(qParams);
    }

    // Detect if we have landed here with an SSO identifier in the URL.
    // This is used by integrations that want to "short-circuit" the login to send users
    // directly to their IdP to simulate IdP-initiated SSO, so we submit automatically.
    if (qParams.identifier != null) {
      this.identifierFormControl.setValue(qParams.identifier);
      this.loggingIn = true;
      await this.submit();
      return;
    }

    // Try to determine the identifier using claimed domain or local state
    // persisted from the user's last login attempt.
    await this.initializeIdentifierFromEmailOrStorage();
  }

  /**
   * Sets the required SSO variables from the query params
   * @param qParams - The query params
   */
  private initializeFromRedirectFromOtherClient(qParams: QueryParams): void {
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
    return [ClientType.Web, ClientType.Browser, ClientType.Desktop, ClientType.Cli].includes(
      value as ClientType,
    );
  }

  /**
   * Checks if the query params have the required SSO params to initiate SSO
   * * The query params presented here are:
   *  - clientId: The client type (e.g. web, browser, desktop)
   *  - redirectUri: The URI to redirect to after authentication
   *  - state: The state to verify on the client after authentication
   *  - codeChallenge: The PKCE code challenge that is sent up when authenticating with the IdP
   * @param qParams - The query params
   * @returns True if the query params have the required SSO params, false otherwise
   */
  private hasParametersFromOtherClientRedirect(qParams: QueryParams): boolean {
    return (
      qParams.clientId != null &&
      qParams.redirectUri != null &&
      qParams.state != null &&
      qParams.codeChallenge != null
    );
  }

  /**
   * Handles the case in which the user has completed SSO authentication, has a code
   * and has been redirected back to the SSO component to exchange the code for a token.
   * This will be on the client originating the SSO request, not always the web client, as that
   * is where the state and verifier are stored.
   * @param qParams - The query params
   */
  private async handleTokenRequestForAuthenticatedUser(qParams: QueryParams): Promise<void> {
    // We set these in state prior to starting SSO, so we can retrieve them here
    const codeVerifier = await this.ssoLoginService.getCodeVerifier();
    const stateFromPrelogin = await this.ssoLoginService.getSsoState();

    // Reset the code verifier and state so we don't accidentally use them again
    await this.ssoLoginService.setCodeVerifier("");
    await this.ssoLoginService.setSsoState("");

    if (qParams.redirectUri != null) {
      this.redirectUri = qParams.redirectUri;
    }

    // Verify that the state matches the state we set prior to starting SSO.
    // If it does, we can proceed with exchanging the code for a token.
    if (
      qParams.code != null &&
      codeVerifier != null &&
      stateFromPrelogin != null &&
      this.verifyStateMatches(stateFromPrelogin, qParams.state ?? "")
    ) {
      const ssoOrganizationIdentifier = this.getOrgIdentifierFromState(qParams.state ?? "");
      await this.logIn(qParams.code, codeVerifier, ssoOrganizationIdentifier);
    }
  }

  /**
   * Checks if the query params have a code and state, indicating that we've completed SSO authentication
   * and have been redirected back to the SSO component on the originating client to complete login.
   * @param qParams - The query params
   * @returns True if the query params have a code and state, false otherwise
   */
  private userCompletedSsoAuthentication(qParams: QueryParams): boolean {
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

  /**
   * Redirects the user to `/connect/authorize` on IdentityServer to begin SSO.
   * @param returnUri - The URI to redirect to after authentication (used to link user to SSO)
   * @param includeUserIdentifier - Whether to include the user identifier in the request (used to link user to SSO)
   */
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

    // Initialize the challenge and state if they aren't passed in. If we're performing SSO initiated on a
    // different client, they'll be passed in, as they will need to be verified on that client and not the web.
    // If they're not passed in, then we need to set them here on the web client to be verified here after SSO.
    if (codeChallenge == null) {
      const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
      const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
      codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);
      await this.ssoLoginService.setCodeVerifier(codeVerifier);
    }

    if (state == null) {
      state = await this.passwordGenerationService.generatePassword(passwordOptions);
    }

    // If we have a returnUri, add it to the state parameter. This will be used after SSO
    // is complete, on the sso-connector, in order to route the user somewhere other than the SSO component.
    if (returnUri) {
      state += `_returnUri='${returnUri}'`;
    }

    // Add Organization Identifier to state
    state += `_identifier=${this.identifier}`;

    // Save the pre-SSO state.
    // We need to do this here as even if it was generated on the intiating client (e.g. browser, desktop),
    // we need it on the web client to verify after the user authenticates with the identity provider and is redirected back.
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

    // If we're linking a user to SSO, we need to provide a user identifier that will be passed
    // on to the SSO provider so that after SSO we can link the user to the SSO identity.
    if (includeUserIdentifier) {
      const userIdentifier = await this.apiService.getSsoUserIdentifier();
      authorizeUrl += `&user_identifier=${encodeURIComponent(userIdentifier)}`;
    }

    return authorizeUrl;
  }

  /**
   * We are using the Auth Code + PKCE flow.
   * We have received the code from IdentityServer, which we will now present with the code verifier to get a token.
   */
  private async logIn(code: string, codeVerifier: string, orgSsoIdentifier: string): Promise<void> {
    this.loggingIn = true;
    try {
      // The code verifier is used to ensure that the client presenting the code is the same one that initiated the authentication request.
      // The redirect URI is also supplied on the request to the token endpoint, so the server can ensure it matches the original request
      // for the code and prevent authorization code injection attacks.
      const redirectUri = this.redirectUri ?? "";
      const credentials = new SsoLoginCredentials(
        code,
        codeVerifier,
        redirectUri,
        orgSsoIdentifier,
        this.email ?? undefined,
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

      await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(
        orgSsoIdentifier,
        authResult.userId,
      );

      if (
        (await firstValueFrom(
          this.keyConnectorService.requiresDomainConfirmation$(authResult.userId),
        )) != null
      ) {
        await this.router.navigate(["confirm-key-connector-domain"]);
        return;
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
    const route = "set-initial-password";
    await this.router.navigate([route], {
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

  /**
   * Checks if the state matches the checkState
   * @param originalStateValue - The state to check
   * @param stateValueToCheck - The state to check against
   * @returns True if the state matches the checkState, false otherwise
   */
  private verifyStateMatches(originalStateValue: string, stateValueToCheck: string): boolean {
    if (originalStateValue === null || originalStateValue === undefined) {
      return false;
    }
    if (stateValueToCheck === null || stateValueToCheck === undefined) {
      return false;
    }

    const stateSplit = originalStateValue.split("_identifier=");
    const checkStateSplit = stateValueToCheck.split("_identifier=");
    return stateSplit[0] === checkStateSplit[0];
  }

  /**
   * Attempts to initialize the SSO identifier from email or storage.
   * Note: this flow is written for web but both browser and desktop
   * redirect here on SSO button click.
   */
  private async initializeIdentifierFromEmailOrStorage(): Promise<void> {
    if (this.email) {
      // show loading spinner
      this.loggingIn = true;
      try {
        // Check if email matches any claimed domains
        const response: ListResponse<VerifiedOrganizationDomainSsoDetailsResponse> =
          await this.orgDomainApiService.getVerifiedOrgDomainsByEmail(this.email);

        if (response.data.length > 0) {
          this.identifierFormControl.setValue(response.data[0].organizationIdentifier);
          await this.submit();
          return;
        }
      } catch (error) {
        this.handleGetClaimedDomainByEmailError(error);
      }

      this.loggingIn = false;
    }

    // If we don't find a claimed domain, check to see if we stored an identifier in state
    // from their last attrempt to login via SSO. If so, we'll populate the field, but not submit.
    const storedIdentifier = await this.ssoLoginService.getOrganizationSsoIdentifier();
    if (storedIdentifier != null) {
      this.identifierFormControl.setValue(storedIdentifier);
    }
  }
}
