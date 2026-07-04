import { Observable, combineLatest, map } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { CONFIG_DISK, StateProvider, UserKeyDefinition } from "../../state";

import { EarlyAccessService } from "./early-access.service";

export const USER_EARLY_ACCESS_ENABLED = new UserKeyDefinition<boolean>(
  CONFIG_DISK,
  "earlyAccessEnabled",
  {
    deserializer: (v) => v ?? false,
    // Persist across logout so a user who re-authenticates keeps their preference.
    clearOn: [],
  },
);

export class DefaultEarlyAccessService implements EarlyAccessService {
  constructor(
    private stateProvider: StateProvider,
    private configService: ConfigService,
  ) {}

  earlyAccess$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.userCachedFeatureFlag$(FeatureFlag.EarlyAccess, userId),
      this.stateProvider.getUser(userId, USER_EARLY_ACCESS_ENABLED).state$,
    ]).pipe(map(([flagEnabled, stored]) => flagEnabled === true && (stored ?? false)));
  }

  async setEarlyAccess(userId: UserId, enabled: boolean): Promise<void> {
    await this.stateProvider.setUserState(USER_EARLY_ACCESS_ENABLED, enabled, userId);
    await this.configService.invalidateUserConfig(userId);
  }
}
