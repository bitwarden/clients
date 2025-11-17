import { ClientType } from "@bitwarden/client-type";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NavigatorCredentialsService } from "../../abstractions/webauthn/navigator-credentials.service";

export class DefaultNavigatorCredentialsService implements NavigatorCredentialsService {
  private navigatorCredentials: CredentialsContainer;

  constructor(
    private window: Window,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.navigatorCredentials = this.window.navigator.credentials;
  }

  async get(options: CredentialRequestOptions): Promise<Credential | null> {
    return await this.navigatorCredentials.get(options);
  }

  async available(): Promise<boolean> {
    return this.platformUtilsService.getClientType() === ClientType.Web;
  }
}
