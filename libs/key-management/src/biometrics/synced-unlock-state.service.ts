import { Observable, map } from "rxjs";

import { ActiveUserState, StateProvider } from "@bitwarden/common/platform/state";

import { SYNCED_UNLOCK_ENABLED } from "./synced-unlock.state";

export abstract class SyncedUnlockStateServiceAbstraction {
  /**
   * syncedUnlockEnabled$ is an observable that emits the current state of the synced unlock feature.
   */
  abstract syncedUnlockEnabled$: Observable<boolean>;
  /**
   * Updates whether the unlock state should be synced with the desktop client.
   * @param enabled the value to save
   */
  abstract setSyncedUnlockEnabled(enabled: boolean): Promise<void>;
}

export class DefaultSyncedUnlockStateService implements SyncedUnlockStateServiceAbstraction {
  private syncedUnlockEnabledState: ActiveUserState<boolean>;
  syncedUnlockEnabled$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    this.syncedUnlockEnabledState = this.stateProvider.getActive(SYNCED_UNLOCK_ENABLED);
    this.syncedUnlockEnabled$ = this.syncedUnlockEnabledState.state$.pipe(map(Boolean));
  }

  async setSyncedUnlockEnabled(enabled: boolean): Promise<void> {
    await this.syncedUnlockEnabledState.update(() => enabled);
  }
}
