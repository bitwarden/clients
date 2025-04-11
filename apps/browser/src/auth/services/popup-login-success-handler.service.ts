import { DefaultLoginSuccessHandlerService } from "@bitwarden/auth/common";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";

import { PopupRouterCacheService } from "../../platform/popup/view-cache/popup-router-cache.service";

export class PopupLoginSuccessHandlerService extends DefaultLoginSuccessHandlerService {
  constructor(
    syncService: SyncService,
    userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private popupRouterCacheService: PopupRouterCacheService,
  ) {
    super(syncService, userAsymmetricKeysRegenerationService);
  }

  async run(userId: UserId): Promise<void> {
    await this.popupRouterCacheService.setHistory([]);
    await super.run(userId);
  }
}
