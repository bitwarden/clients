import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  PasswordGenerationServiceAbstraction,
  PasswordGeneratorOptions,
} from "@bitwarden/generator-legacy";

/**
 * Provides a service for linking SSO.
 */
export class LinkSsoService {
  constructor(
    private ssoLoginService: SsoLoginServiceAbstraction,
    private apiService: ApiService,
    private cryptoFunctionService: CryptoFunctionService,
    private environmentService: EnvironmentService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  /**
   * Links SSO to an organization.
   * Ported from the SsoComponent
   * @param identifier The identifier of the organization to link to.
   */
  async linkSso(identifier: string) {
    if (identifier == null || identifier === "") {
      throw new Error("SSO identifier is required");
    }

    const redirectUri = window.location.origin + "/sso-connector.html";
    const clientId = "web";
    const returnUri = "/settings/organizations";

    const response = await this.apiService.preValidateSso(identifier);

    const passwordOptions: PasswordGeneratorOptions = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      number: true,
      special: false,
    };

    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);
    await this.ssoLoginService.setCodeVerifier(codeVerifier);

    let state = await this.passwordGenerationService.generatePassword(passwordOptions);
    state += `_returnUri='${returnUri}'`;
    state += `_identifier=${identifier}`;

    // Save state
    await this.ssoLoginService.setSsoState(state);

    const env = await firstValueFrom(this.environmentService.environment$);

    let authorizeUrl =
      env.getIdentityUrl() +
      "/connect/authorize?" +
      "client_id=" +
      clientId +
      "&redirect_uri=" +
      encodeURIComponent(redirectUri) +
      "&" +
      "response_type=code&scope=api offline_access&" +
      "state=" +
      state +
      "&code_challenge=" +
      codeChallenge +
      "&" +
      "code_challenge_method=S256&response_mode=query&" +
      "domain_hint=" +
      encodeURIComponent(identifier) +
      "&ssoToken=" +
      encodeURIComponent(response.token);

    const userIdentifier = await this.apiService.getSsoUserIdentifier();
    authorizeUrl += `&user_identifier=${encodeURIComponent(userIdentifier)}`;

    this.platformUtilsService.launchUri(authorizeUrl, { sameWindow: true });
  }
}
