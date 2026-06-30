import { firstValueFrom, map, Observable } from "rxjs";

import {
  SHARED_UNLOCK_SETTINGS_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";

import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

const ALLOW_SHARING_UNLOCK_STATE = new UserKeyDefinition<boolean>(
  SHARED_UNLOCK_SETTINGS_DISK,
  "allowSharingUnlockState",
  {
    deserializer: (b) => b,
    clearOn: ["logout"],
  },
);

export class DefaultSharedUnlockSettingsService extends SharedUnlockSettingsService {
  constructor(private stateProvider: StateProvider) {
    super();
  }

  async setAllowSharingUnlockState(value: boolean, userId: UserId) {
    await this.stateProvider.getUser(userId, ALLOW_SHARING_UNLOCK_STATE).update(() => value);
  }

  allowSharingUnlockState$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(ALLOW_SHARING_UNLOCK_STATE, userId)
      .pipe(map((v) => v ?? true));
  }

  async allowSharingUnlockState(userId: UserId): Promise<boolean> {
    return (
      (await firstValueFrom(
        this.stateProvider.getUserState$(ALLOW_SHARING_UNLOCK_STATE, userId),
      )) ?? true
    );
  }
}
