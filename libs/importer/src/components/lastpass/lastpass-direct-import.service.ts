// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, NgZone } from "@angular/core";
import * as oauth from "oauth4webapi";
import { Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { ClientInfo, Vault } from "../../importers/lastpass/access";
import { LastpassLoginType } from "../../importers/lastpass/access/enums";
import { FederatedUserContext } from "../../importers/lastpass/access/models";

import { LastPassPasswordPromptComponent } from "./dialog/lastpass-password-prompt.component";
import { LastPassDirectImportUIService } from "./lastpass-direct-import-ui.service";

@Injectable({
  providedIn: "root",
})
export class LastPassDirectImportService {
  private vault: Vault;

  private oidcFlow?: {
    as: oauth.AuthorizationServer;
    client: oauth.Client;
    codeVerifier: string;
    nonce: string;
    state: string;
    userState: { email: string };
    redirectUri: string;
  };

  private _ssoImportCallback$ = new Subject<{ oidcCode: string; oidcState: string }>();
  ssoImportCallback$ = this._ssoImportCallback$.asObservable();

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private environmentService: EnvironmentService,
    private appIdService: AppIdService,
    private lastPassDirectImportUIService: LastPassDirectImportUIService,
    private platformUtilsService: PlatformUtilsService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {
    this.vault = new Vault(this.cryptoFunctionService);

    /** TODO: remove this in favor of dedicated service */
    this.broadcasterService.subscribe("LastPassDirectImportService", (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "importCallbackLastPass":
            this._ssoImportCallback$.next({ oidcCode: message.code, oidcState: message.state });
            break;
          default:
            break;
        }
      });
    });
  }

  /**
   * Import a LastPass account by email
   * @param email
   * @param includeSharedFolders
   * @returns The CSV export data of the account
   */
  async handleImport(email: string, includeSharedFolders: boolean): Promise<string> {
    await this.verifyLastPassAccountExists(email);

    if (this.isAccountFederated) {
      const oidc = await this.handleFederatedLogin(email);
      const csvData = await this.handleFederatedImport(
        oidc.oidcCode,
        oidc.oidcState,
        includeSharedFolders,
      );
      return csvData;
    }
    const password = await LastPassPasswordPromptComponent.open(this.dialogService);
    const csvData = await this.handleStandardImport(email, password, includeSharedFolders);

    return csvData;
  }

  private get isAccountFederated(): boolean {
    return this.vault.userType.isFederated();
  }

  private async verifyLastPassAccountExists(email: string) {
    await this.vault.setUserTypeContext(email);
  }

  private async handleFederatedLogin(email: string) {
    const ssoCallbackPromise = firstValueFrom(this.ssoImportCallback$);
    const request = await this.createOidcSigninRequest(email);
    this.platformUtilsService.launchUri(request.url);

    const cancelDialogRef = this.dialogService.openSimpleDialogRef({
      title: this.i18nService.t("awaitingSSO"),
      content: this.i18nService.t("awaitingSSODesc"),
      type: "warning",
      icon: "bwi-key",
      acceptButtonText: this.i18nService.t("cancel"),
      cancelButtonText: null,
    });
    const cancelled = firstValueFrom(cancelDialogRef.closed).then((_didCancel) => {
      throw Error("SSO auth cancelled");
    });

    return Promise.race<{
      oidcCode: string;
      oidcState: string;
    }>([cancelled, ssoCallbackPromise]).finally(() => {
      void cancelDialogRef.close();
    });
  }

  private async createOidcSigninRequest(email: string): Promise<{ url: string }> {
    try {
      const issuer = new URL(this.vault.userType.openIDConnectAuthorityBase);
      const as = await oauth
        .discoveryRequest(issuer, { algorithm: "oidc" })
        .then((response) => oauth.processDiscoveryResponse(issuer, response));

      const client: oauth.Client = {
        client_id: this.vault.userType.openIDConnectClientId,
      };

      const codeVerifier = oauth.generateRandomCodeVerifier();
      const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
      const state = oauth.generateRandomState();
      const nonce = oauth.generateRandomNonce();
      const redirectUri = await this.getOidcRedirectUrl();

      this.oidcFlow = {
        as,
        client,
        codeVerifier,
        nonce,
        state,
        userState: { email },
        redirectUri,
      };

      const authorizeUrl = new URL(as.authorization_endpoint!);
      authorizeUrl.searchParams.set("client_id", client.client_id);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("response_mode", "query");
      authorizeUrl.searchParams.set("scope", this.vault.userType.oidcScope);
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("nonce", nonce);
      authorizeUrl.searchParams.set("code_challenge", codeChallenge);
      authorizeUrl.searchParams.set("code_challenge_method", "S256");

      return { url: authorizeUrl.toString() };
    } catch (err) {
      this.logService.error("Unable to generate OIDC sign in request");
      throw err;
    }
  }

  private async processOidcSigninResponse(
    oidcCode: string,
    oidcState: string,
  ): Promise<{
    id_token: string;
    access_token: string;
    profile: Record<string, unknown>;
    userState: { email: string };
  }> {
    if (this.oidcFlow == null) {
      throw new Error("No OIDC sign in request is in progress.");
    }
    const flow = this.oidcFlow;

    const callbackUrl = new URL(this.getOidcRedirectUrlWithParams(oidcCode, oidcState));
    const params = oauth.validateAuthResponse(flow.as, flow.client, callbackUrl, flow.state);

    const tokenResponse = await oauth.authorizationCodeGrantRequest(
      flow.as,
      flow.client,
      oauth.None(),
      params,
      flow.redirectUri,
      flow.codeVerifier,
    );
    const tokens = await oauth.processAuthorizationCodeResponse(
      flow.as,
      flow.client,
      tokenResponse,
      { expectedNonce: flow.nonce, requireIdToken: true },
    );

    const idTokenClaims = oauth.getValidatedIdTokenClaims(tokens)!;

    const userInfoResponse = await oauth.userInfoRequest(flow.as, flow.client, tokens.access_token);
    const userInfo = await oauth.processUserInfoResponse(
      flow.as,
      flow.client,
      idTokenClaims.sub,
      userInfoResponse,
    );

    return {
      id_token: tokens.id_token!,
      access_token: tokens.access_token,
      profile: { ...idTokenClaims, ...userInfo },
      userState: flow.userState,
    };
  }

  private getOidcRedirectUrlWithParams(oidcCode: string, oidcState: string) {
    const redirectUri = this.oidcFlow!.redirectUri;
    const params = "code=" + oidcCode + "&state=" + oidcState;
    if (redirectUri.indexOf("bitwarden://") === 0) {
      return redirectUri + "/?" + params;
    }

    return redirectUri + "&" + params;
  }

  private async getOidcRedirectUrl() {
    const clientType = this.platformUtilsService.getClientType();
    if (clientType === ClientType.Desktop) {
      return "bitwarden://import-callback-lp";
    }
    const env = await firstValueFrom(this.environmentService.environment$);
    const webUrl = env.getWebVaultUrl();
    return webUrl + "/sso-connector.html?lp=1";
  }

  private async handleStandardImport(
    email: string,
    password: string,
    includeSharedFolders: boolean,
  ): Promise<string> {
    const clientInfo = await this.createClientInfo(email, LastpassLoginType.MasterPassword);

    try {
      await this.vault.open(email, password, clientInfo, this.lastPassDirectImportUIService, {
        parseSecureNotesToAccount: false,
      });
    } catch (err) {
      this.logService.error("Unable to open LastPass vault");
      throw err;
    }

    return this.vault.accountsToExportedCsvString(!includeSharedFolders);
  }

  private async handleFederatedImport(
    oidcCode: string,
    oidcState: string,
    includeSharedFolders: boolean,
  ): Promise<string> {
    const federatedUser = new FederatedUserContext();
    try {
      const response = await this.processOidcSigninResponse(oidcCode, oidcState);
      federatedUser.idToken = response.id_token;
      federatedUser.accessToken = response.access_token;
      federatedUser.idpUserInfo = response.profile;
      federatedUser.username = response.userState.email;
    } catch (err) {
      this.logService.error("Unable to process OIDC sign in response");
      throw err;
    }

    const clientInfo = await this.createClientInfo(
      federatedUser.username,
      LastpassLoginType.Federated,
    );
    try {
      await this.vault.openFederated(
        federatedUser,
        clientInfo,
        this.lastPassDirectImportUIService,
        {
          parseSecureNotesToAccount: false,
        },
      );
    } catch (err) {
      this.logService.error("Unable to open LastPass vault with federated user");
      throw err;
    }

    return this.vault.accountsToExportedCsvString(!includeSharedFolders);
  }

  private async createClientInfo(email: string, loginType: LastpassLoginType): Promise<ClientInfo> {
    const appId = await this.appIdService.getAppId();
    const id = "lastpass" + appId + email;
    const idHash = await this.cryptoFunctionService.hash(id, "sha256");
    return ClientInfo.createClientInfo(Utils.fromArrayToHex(idHash), loginType);
  }
}
