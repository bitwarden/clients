import { firstValueFrom, Observable } from "rxjs";

import { KDF_CONFIG } from "@bitwarden/common/key-management/state-definitions";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

import { KdfConfigService } from "./abstractions/kdf-config.service";

export class DefaultKdfConfigService implements KdfConfigService {
  constructor(private stateProvider: StateProvider) {}

  async setKdfConfig(userId: UserId, kdfConfig: KdfConfig) {
    if (userId == null) {
      throw new Error("userId cannot be null");
    }
    if (kdfConfig == null) {
      throw new Error("kdfConfig cannot be null");
    }
    await this.stateProvider.setUserState(KDF_CONFIG, kdfConfig, userId);
  }

  async getKdfConfig(userId: UserId): Promise<KdfConfig> {
    if (userId == null) {
      throw new Error("userId cannot be null");
    }

    const state = await firstValueFrom(this.stateProvider.getUser(userId, KDF_CONFIG).state$);
    if (state == null) {
      throw new Error("KdfConfig for user " + userId + " is null");
    }
    return state;
  }

  getKdfConfig$(userId: UserId): Observable<KdfConfig | null> {
    if (userId == null) {
      throw new Error("userId cannot be null");
    }
    return this.stateProvider.getUser(userId, KDF_CONFIG).state$;
  }
}
