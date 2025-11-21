import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { LoginSuccessHandlerService } from "../../abstractions/login-success-handler.service";
import { LoginEmailService } from "../login-email/login-email.service";

export class DefaultLoginSuccessHandlerService implements LoginSuccessHandlerService {
  constructor(
    private configService: ConfigService,
    private loginEmailService: LoginEmailService,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private logService: LogService,
  ) {}
  async run(userId: UserId): Promise<void> {
    await this.syncService.fullSync(true, { skipTokenRefresh: true });
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
    await this.loginEmailService.clearLoginEmail();

    const ssoLoginEmail = await this.ssoLoginService.getSsoEmail();

    if (!ssoLoginEmail) {
      this.logService.error("SSO login email not found.");
      return;
    }

    await this.ssoLoginService.updateSsoRequiredCache(ssoLoginEmail, userId);
    await this.ssoLoginService.clearSsoEmail();
  }
}
