import { firstValueFrom, Observable } from "rxjs";
import { Jsonify } from "type-fest/source/jsonify";

import {
  KDF_CONFIG_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { KdfConfigService } from "./abstractions/kdf-config.service";
import { KdfType } from "./enums/kdf-type.enum";
import { Argon2KdfConfig, KdfConfig, PBKDF2KdfConfig } from "./models/kdf-config";

export const KDF_CONFIG = new UserKeyDefinition<KdfConfig>(KDF_CONFIG_DISK, "kdfConfig", {
  deserializer: (kdfConfig: Jsonify<KdfConfig>) => {
    if (kdfConfig == null) {
      return null;
    }
    return kdfConfig.kdfType === KdfType.PBKDF2_SHA256
      ? PBKDF2KdfConfig.fromJSON(kdfConfig)
      : Argon2KdfConfig.fromJSON(kdfConfig);
  },
  clearOn: ["logout"],
});

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
