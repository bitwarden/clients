import { Directive } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoFunctionService } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { SsoLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { Utils } from "@bitwarden/common/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { Guid } from "@bitwarden/common/types/guid";

@Directive()
export class SsoComponent {
  identifier: string;
  loggingIn = false;

  formPromise: Promise<AuthResult>;
  initiateSsoFormPromise: Promise<SsoPreValidateResponse>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginChangePasswordNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  protected twoFactorRoute = "2fa";
  protected successRoute = "lock";
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
    protected logService: LogService
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
          await this.logIn(
            qParams.code,
            codeVerifier,
            this.getOrgIdentifierFromState(qParams.state)
          );
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

  private async logIn(code: string, codeVerifier: string, orgIdFromState: Guid) {
    this.loggingIn = true;
    try {
      const credentials = new SsoLogInCredentials(
        code,
        codeVerifier,
        this.redirectUri,
        orgIdFromState
      );
      this.formPromise = this.authService.logIn(credentials);
      const response = await this.formPromise;
      if (response.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          this.router.navigate([this.twoFactorRoute], {
            queryParams: {
              identifier: orgIdFromState,
              sso: "true",
            },
          });
        }
      } else if (response.resetMasterPassword) {
        if (this.onSuccessfulLoginChangePasswordNavigate != null) {
          this.onSuccessfulLoginChangePasswordNavigate();
        } else {
          this.router.navigate([this.changePasswordRoute], {
            queryParams: {
              identifier: orgIdFromState,
            },
          });
        }
      } else if (response.forcePasswordReset) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        const disableFavicon = await this.stateService.getDisableFavicon();
        await this.stateService.setDisableFavicon(!!disableFavicon);
        if (this.onSuccessfulLogin != null) {
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          this.onSuccessfulLoginNavigate();
        } else {
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (e) {
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
    this.loggingIn = false;
  }

  private getOrgIdentifierFromState(state: string): Guid {
    if (state === null || state === undefined) {
      return null;
    }

    const stateSplit = state.split("_identifier=");
    return (stateSplit.length > 1 ? stateSplit[1] : null) as Guid;
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
