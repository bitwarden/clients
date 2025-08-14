import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";

import { LoginSuccessHandlerService } from "../../abstractions/login-success-handler.service";
import { LoginEmailService } from "../login-email/login-email.service";

export class DefaultLoginSuccessHandlerService implements LoginSuccessHandlerService {
  constructor(
    private syncService: SyncService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private loginEmailService: LoginEmailService,
    private encryptedMigrator: EncryptedMigrator,
  ) {}

  async run(userId: UserId, masterPassword?: string): Promise<void> {
    await this.syncService.fullSync(true, { skipTokenRefresh: true });
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
    await this.loginEmailService.clearLoginEmail();
    await this.encryptedMigrator.runMigrations(userId, masterPassword);
  }
}
