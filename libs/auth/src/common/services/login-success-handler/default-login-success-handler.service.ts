import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";

import { LoginSuccessHandlerService } from "../../abstractions/login-success-handler.service";

export class DefaultLoginSuccessHandlerService implements LoginSuccessHandlerService {
  constructor(
    private syncService: SyncService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
  ) {}
  async run(userId: UserId): Promise<void> {
    await this.syncService.fullSync(true);
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
  }
}
