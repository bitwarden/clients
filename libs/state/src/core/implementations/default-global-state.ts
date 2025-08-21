import { LogService } from "@bitwarden/logging";
import { AbstractStorageService, ObservableStorageService } from "@bitwarden/storage-core";

import { GlobalState } from "../global-state";
import { KeyDefinition, globalKeyBuilder } from "../key-definition";

import { StateBase } from "./state-base";

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
