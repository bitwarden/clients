import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { SsoComponentService } from "@bitwarden/auth/angular";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

@Injectable({
  providedIn: "root",
})
export class LinkSsoService {
  constructor(
    private environmentService: EnvironmentService,
    private ssoComponentService: SsoComponentService,
    private apiService: ApiService,
    private cryptoFunctionService: CryptoFunctionService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private ssoLoginService: SsoLoginServiceAbstraction,
  ) {}

  /**
   * Link the current user to SSO for the specified organization
   * @param organization The organization to link SSO for
   */
  async linkSso(organization: Organization): Promise<void> {
    const returnUri = "/settings/organizations";
    const redirectUri = window.location.origin + "/sso-connector.html";
    const clientId = "web";

    // Validate the organization identifier
    if (!organization?.identifier) {
      throw new Error("Organization identifier is required for SSO linking");
    }

    // Get an SSO token for pre-validation
    const tokenResponse = await this.apiService.preValidateSso(organization.identifier);

    // Build the authorize URL with the proper parameters
    const authorizeUrl = await this.buildAuthorizeUrl(
      clientId,
      redirectUri,
      returnUri,
      organization.identifier,
      tokenResponse.token,
    );

    // Set cookies for SSO handoff
    this.ssoComponentService.setDocumentCookies?.();

    // Redirect to SSO login
    window.location.href = authorizeUrl;
  }

  /**
   * Build the SSO authorization URL.
   * Ported from libs/angular/src/auth/components/sso.component.ts
   * @param clientId The client ID
   * @param redirectUri The redirect URI
   * @param returnUri The return URI
   * @param identifier The organization identifier
   * @param token The SSO token
   * @returns The authorize URL
   */
  private async buildAuthorizeUrl(
    clientId: string,
    redirectUri: string,
    returnUri: string,
    identifier: string,
    token: string,
  ): Promise<string> {
    const passwordOptions = {
      type: "password" as const,
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save the code verifier for the callback
    await this.ssoLoginService.setCodeVerifier(codeVerifier);

    // Generate state and add return URI and identifier
    const state = await this.passwordGenerationService.generatePassword(passwordOptions);
    const fullState = `${state}_returnUri='${returnUri}'_identifier=${identifier}`;

    // Save state for verification on callback
    await this.ssoLoginService.setSsoState(fullState);

    // Get environment
    const env = await firstValueFrom(this.environmentService.environment$);

    // Construct the authorize URL
    return (
      `${env.getIdentityUrl()}/connect/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=api offline_access` +
      `&state=${encodeURIComponent(fullState)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256` +
      `&response_mode=query` +
      `&domain_hint=${encodeURIComponent(identifier)}` +
      `&ssoToken=${encodeURIComponent(token)}`
    );
  }
}
