import { Observable, combineLatest, of } from "rxjs";

import { LogService } from "@bitwarden/logging";
import {
  CombinedState,
  SingleUserState,
  StateEventRegistrarService,
  UserKeyDefinition,
} from "@bitwarden/state";
import { AbstractStorageService, ObservableStorageService } from "@bitwarden/storage-core";
import { UserId } from "@bitwarden/user-core";

import { StateBase } from "./state-base";

export class DefaultSingleUserState<T>
  extends StateBase<T, UserKeyDefinition<T>>
  implements SingleUserState<T>
{
  readonly combinedState$: Observable<CombinedState<T | null>>;

  constructor(
    readonly userId: UserId,
    keyDefinition: UserKeyDefinition<T>,
    chosenLocation: AbstractStorageService & ObservableStorageService,
    private stateEventRegistrarService: StateEventRegistrarService,
    logService: LogService,
  ) {
    super(keyDefinition.buildKey(userId), chosenLocation, keyDefinition, logService);
    this.combinedState$ = combineLatest([of(userId), this.state$]);
  }

  protected override async doStorageSave(newState: T, oldState: T): Promise<void> {
    await super.doStorageSave(newState, oldState);
    await this.stateEventRegistrarService.registerEvents(this.keyDefinition);
  }
}
