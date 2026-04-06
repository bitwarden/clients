// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/logging";
import { GlobalState, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";
import { StorageServiceProvider } from "@bitwarden/storage-core";

import { DefaultGlobalState } from "./default-global-state";

export class DefaultGlobalStateProvider implements GlobalStateProvider {
  private globalStateCache: Record<string, GlobalState<unknown>> = {};

  constructor(
    private storageServiceProvider: StorageServiceProvider,
    private readonly logService: LogService,
  ) {}

  get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    const [location, storageService] = this.storageServiceProvider.get(
      keyDefinition.stateDefinition.defaultStorageLocation,
      keyDefinition.stateDefinition.storageLocationOverrides,
    );
    const cacheKey = this.buildCacheKey(location, keyDefinition);
    const existingGlobalState = this.globalStateCache[cacheKey];
    if (existingGlobalState != null) {
      // The cast into the actual generic is safe because of rules around key definitions
      // being unique.
      return existingGlobalState as DefaultGlobalState<T>;
    }

    const newGlobalState = new DefaultGlobalState<T>(
      keyDefinition,
      storageService,
      this.logService,
    );

    this.globalStateCache[cacheKey] = newGlobalState;
    return newGlobalState;
  }

  private buildCacheKey(location: string, keyDefinition: KeyDefinition<unknown>) {
    return `${location}_${keyDefinition.fullName}`;
  }
}
