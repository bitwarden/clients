import { LogService } from "@bitwarden/logging";
import { GlobalState, KeyDefinition } from "@bitwarden/state";
import { AbstractStorageService, ObservableStorageService } from "@bitwarden/storage-core";

import { StateBase } from "./state-base";
import { globalKeyBuilder } from "./util";

export class DefaultGlobalState<T>
  extends StateBase<T, KeyDefinition<T>>
  implements GlobalState<T>
{
  constructor(
    keyDefinition: KeyDefinition<T>,
    chosenLocation: AbstractStorageService & ObservableStorageService,
    logService: LogService,
  ) {
    super(globalKeyBuilder(keyDefinition), chosenLocation, keyDefinition, logService);
  }
}
