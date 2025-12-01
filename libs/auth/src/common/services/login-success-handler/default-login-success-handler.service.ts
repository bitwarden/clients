import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
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
    private encryptedMigrator: EncryptedMigrator,
    private logService: LogService,
  ) {}

  async run(userId: UserId, masterPassword: string | null): Promise<void> {
    await this.syncService.fullSync(true, { skipTokenRefresh: true });
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
    await this.loginEmailService.clearLoginEmail();
    try {
      await this.encryptedMigrator.runMigrations(userId, masterPassword);
    } catch {
      // Don't block login success on migration failure
    }

    const ssoLoginEmail = await this.ssoLoginService.getSsoEmail();

    if (!ssoLoginEmail) {
      this.logService.error("SSO login email not found.");
      return;
    }

    await this.ssoLoginService.updateSsoRequiredCache(ssoLoginEmail, userId);
    await this.ssoLoginService.clearSsoEmail();
  }
}
