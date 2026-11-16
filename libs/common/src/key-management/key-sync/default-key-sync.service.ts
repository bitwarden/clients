import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { withPasswordManagerSdk } from "../utils";

import { KeySyncService } from "./abstractions/key-sync.service";

export class DefaultKeySyncService implements KeySyncService {
  constructor(private sdkService: SdkService) {}

  async syncKeys(userId: UserId): Promise<void> {
    await withPasswordManagerSdk(userId, this.sdkService, (sdk) =>
      sdk.crypto_sync_handler().sync_keys(),
    );
  }
}
