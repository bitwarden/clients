// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/logging";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { UserId } from "@bitwarden/user-core";

import { StateEventRegistrarService } from "../state-event-registrar.service";
import { UserKeyDefinition } from "../user-key-definition";
import { SingleUserState } from "../user-state";
import { SingleUserStateProvider } from "../user-state.provider";

import { DefaultSingleUserState } from "./default-single-user-state";

export class DefaultSingleUserStateProvider implements SingleUserStateProvider {
  private cache: Record<string, SingleUserState<unknown>> = {};

  constructor(
    private readonly storageServiceProvider: StorageServiceProvider,
    private readonly stateEventRegistrarService: StateEventRegistrarService,
    private readonly logService: LogService,
  ) {}

  get<T>(userId: UserId, keyDefinition: UserKeyDefinition<T>): SingleUserState<T> {
    const [location, storageService] = this.storageServiceProvider.get(
      keyDefinition.stateDefinition.defaultStorageLocation,
      keyDefinition.stateDefinition.storageLocationOverrides,
    );
    const cacheKey = this.buildCacheKey(location, userId, keyDefinition);
    const existingUserState = this.cache[cacheKey];
    if (existingUserState != null) {
      // I have to cast out of the unknown generic but this should be safe if rules
      // around domain token are made
      return existingUserState as SingleUserState<T>;
    }

    const newUserState = new DefaultSingleUserState<T>(
      userId,
      keyDefinition,
      storageService,
      this.stateEventRegistrarService,
      this.logService,
    );
    this.cache[cacheKey] = newUserState;
    return newUserState;
  }

  private buildCacheKey(
    location: string,
    userId: UserId,
    keyDefinition: UserKeyDefinition<unknown>,
  ) {
    return `${location}_${keyDefinition.fullName}_${userId}`;
  }
}
