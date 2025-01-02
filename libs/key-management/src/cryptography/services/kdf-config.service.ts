// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Observable } from "rxjs";

import { UserId } from "@bitwarden/common/src/types/guid";

import {
  KDF_CONFIG_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../../../common/src/platform/state";
import { KdfConfigService } from "../abstractions/kdf-config.service";
import { KdfType } from "../enums/kdf-type.enum";
import { Argon2KdfConfig, KdfConfig, PBKDF2KdfConfig } from "../models/kdf-config";

export const KDF_CONFIG = new UserKeyDefinition<KdfConfig>(KDF_CONFIG_DISK, "kdfConfig", {
  deserializer: (kdfConfig: KdfConfig) => {
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
    if (!userId) {
      throw new Error("userId cannot be null");
    }
    if (kdfConfig === null) {
      throw new Error("kdfConfig cannot be null");
    }
    await this.stateProvider.setUserState(KDF_CONFIG, kdfConfig, userId);
  }

  async getKdfConfig(): Promise<KdfConfig> {
    const userId = await firstValueFrom(this.stateProvider.activeUserId$);
    const state = await firstValueFrom(this.stateProvider.getUser(userId, KDF_CONFIG).state$);
    if (state === null) {
      throw new Error("KdfConfig for active user account state is null");
    }
    return state;
  }

  getKdfConfig$(userId: UserId): Observable<KdfConfig> {
    return this.stateProvider.getUser(userId, KDF_CONFIG).state$;
  }
}
