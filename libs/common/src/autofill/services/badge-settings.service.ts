import { map, Observable } from "rxjs";

import {
  BADGE_SETTINGS_DISK,
  ActiveUserState,
  KeyDefinition,
  StateProvider,
} from "../../platform/state";

const ENABLE_BADGE_COUNTER = new KeyDefinition(BADGE_SETTINGS_DISK, "enableBadgeCounter", {
  deserializer: (value: boolean) => value ?? true,
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
