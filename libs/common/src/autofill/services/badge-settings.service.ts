// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable } from "rxjs";

import {
  BADGE_SETTINGS_DISK,
  ActiveUserState,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";

const ENABLE_BADGE_COUNTER = new UserKeyDefinition(BADGE_SETTINGS_DISK, "enableBadgeCounter", {
  deserializer: (value: boolean) => value ?? true,
  clearOn: [],
});

export abstract class BadgeSettingsServiceAbstraction {
  enableBadgeCounter$: Observable<boolean>;
  setEnableBadgeCounter: (newValue: boolean) => Promise<void>;
}

export class BadgeSettingsService implements BadgeSettingsServiceAbstraction {
  private enableBadgeCounterState: ActiveUserState<boolean>;
  readonly enableBadgeCounter$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    this.enableBadgeCounterState = this.stateProvider.getActive(ENABLE_BADGE_COUNTER);
    this.enableBadgeCounter$ = this.enableBadgeCounterState.state$.pipe(map((x) => x ?? true));
  }

  async setEnableBadgeCounter(newValue: boolean): Promise<void> {
    await this.enableBadgeCounterState.update(() => newValue);
  }
}
