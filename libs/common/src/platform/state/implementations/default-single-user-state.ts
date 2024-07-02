import { Observable, combineLatest, of } from "rxjs";

import { UserId } from "../../../types/guid";
import {
  AbstractStorageService,
  ObservableStorageService,
} from "../../abstractions/storage.service";
import { StateEventRegistrarService } from "../state-event-registrar.service";
import { UserKeyDefinition } from "../user-key-definition";
import { CombinedState, SingleUserState } from "../user-state";

import { StateBase } from "./state-base";

export class DefaultSingleUserState<T>
  extends StateBase<T, UserKeyDefinition<T>>
  implements SingleUserState<T>
{
  readonly combinedState$: Observable<CombinedState<T>>;

  constructor(
    readonly userId: UserId,
    keyDefinition: UserKeyDefinition<T>,
    chosenLocation: AbstractStorageService & ObservableStorageService,
    private stateEventRegistrarService: StateEventRegistrarService,
  ) {
    super(keyDefinition.buildKey(userId), chosenLocation, keyDefinition);
    this.combinedState$ = combineLatest([of(userId), this.state$]);
  }

  protected override async doStorageSave(newState: T, oldState: T): Promise<void> {
    if (newState != null) {
      await super.doStorageSave(newState, oldState);
    }
    if (newState != null && oldState == null) {
      await this.stateEventRegistrarService.registerEvents(this.keyDefinition);
    }
  }
}
