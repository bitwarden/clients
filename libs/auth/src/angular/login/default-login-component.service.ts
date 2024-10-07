import { UrlTree } from "@angular/router";
import { firstValueFrom } from "rxjs";

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
  ) {}

  async getOrgPolicies(): Promise<PasswordPolicies | null> {
    return null;
  }

  setPreviousUrl(route: UrlTree): void | null {
    return null;
  }

  isLoginViaAuthRequestSupported(): boolean {
    return false;
  }

  isLoginWithPasskeySupported(): boolean {
    return this.clientType == ClientType.Web;
  }

  async launchSsoBrowserWindow(
    email: string,
    clientId: "browser" | "desktop",
  ): Promise<void | null> {
    // Save email for SSO
    await this.ssoLoginService.setSsoEmail(email);

    // Generate SSO params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    const state = await this.passwordGenerationService.generatePassword(passwordOptions);

    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save SSO params
    await this.ssoLoginService.setSsoState(state);
    await this.ssoLoginService.setCodeVerifier(codeVerifier);

    // Build URL
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    const redirectUri =
      clientId === "browser"
        ? webVaultUrl + "/sso-connector.html" // Browser
        : "bitwarden://sso-callback"; // Desktop

    // Launch browser window with URL
    this.platformUtilsService.launchUri(
      webVaultUrl +
        "/#/sso?clientId=" +
        clientId +
        "&redirectUri=" +
        encodeURIComponent(redirectUri) +
        "&state=" +
        state +
        "&codeChallenge=" +
        codeChallenge +
        "&email=" +
        encodeURIComponent(email),
    );
  }
}
