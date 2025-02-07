import { LoginComponentService, PasswordPolicies } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

export class DefaultLoginComponentService implements LoginComponentService {
  protected clientType: ClientType;

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected environmentService: EnvironmentService,
    // TODO: refactor to not use deprecated service
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected ssoLoginService: SsoLoginServiceAbstraction,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async getOrgPolicies(): Promise<PasswordPolicies | null> {
    return null;
  }

  isLoginWithPasskeySupported(): boolean {
    return this.clientType === ClientType.Web;
  }

  /**
   * Redirects the user to the SSO login page, either via route or in a new browser window.
   * @param email The email address of the user attempting to log in
   */
  async redirectToSsoLogin(email: string): Promise<void | null> {
    // Then, we set the state that we'll need to verify the SSO login when we get the code back
    const [state, codeChallenge] = await this.setSsoPreLoginState();

    // Finally, we redirect to the SSO login page. This will be handled by each client implementation of this service.
    await this.redirectToSso(email, state, codeChallenge);
  }

  /**
   * No-op implementation of redirectToSso
   */
  protected async redirectToSso(
    email: string,
    state: string,
    codeChallenge: string,
  ): Promise<void> {
    return;
  }

  /**
   * No-op implementation of showBackButton
   */
  showBackButton(showBackButton: boolean): void {
    return;
  }

  /**
   * Sets the state required for verifying SSO login after completion
   */
  private async setSsoPreLoginState(): Promise<[string, string]> {
    // Generate SSO params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    let state = await this.passwordGenerationService.generatePassword(passwordOptions);

    if (this.clientType === ClientType.Browser) {
      // Need to persist the clientId in the state for the extension
      state += ":clientId=browser";
    }

    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save SSO params
    await this.ssoLoginService.setSsoState(state);
    await this.ssoLoginService.setCodeVerifier(codeVerifier);

    return [state, codeChallenge];
  }
}
