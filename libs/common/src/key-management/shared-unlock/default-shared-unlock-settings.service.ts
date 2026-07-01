import { map, Observable } from "rxjs";

import {
  SHARED_UNLOCK_SETTINGS_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";

import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

const ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP = new UserKeyDefinition<boolean>(
  SHARED_UNLOCK_SETTINGS_DISK,
  "allowSharingUnlockStateWithDesktop",
  {
    deserializer: (b) => b,
    clearOn: ["logout"],
  },
);

const ALLOW_SHARING_UNLOCK_STATE_WITH_WEB = new UserKeyDefinition<boolean>(
  SHARED_UNLOCK_SETTINGS_DISK,
  "allowSharingUnlockStateWithWeb",
  {
    deserializer: (b) => b,
    clearOn: ["logout"],
  },
);

// Default off because of native messaging permission
const DEFAULT_ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP = false;
const DEFAULT_ALLOW_SHARING_UNLOCK_STATE_WITH_WEB = true;

export class DefaultSharedUnlockSettingsService extends SharedUnlockSettingsService {
  constructor(private stateProvider: StateProvider) {
    super();
  }

  allowSharingUnlockStateWithDesktop$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP, userId)
      .pipe(map((v) => v ?? DEFAULT_ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP));
  }

  async setAllowSharingUnlockStateWithDesktop(value: boolean, userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP)
      .update(() => value);
  }

  allowSharingUnlockStateWithWeb$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(ALLOW_SHARING_UNLOCK_STATE_WITH_WEB, userId)
      .pipe(map((v) => v ?? DEFAULT_ALLOW_SHARING_UNLOCK_STATE_WITH_WEB));
  }

  async setAllowSharingUnlockStateWithWeb(value: boolean, userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, ALLOW_SHARING_UNLOCK_STATE_WITH_WEB)
      .update(() => value);
  }
}
