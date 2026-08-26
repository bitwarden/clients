import { firstValueFrom } from "rxjs";

import {
  KeyDefinition,
  StateDefinition,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { StorageLocation } from "@bitwarden/storage-core";

/** Where a piece of state lives, mirroring the {@link StateDefinition} it was declared with. */
export interface StateAddress {
  /** Name of the owning {@link StateDefinition}, e.g. "vaultSettings". */
  stateName: string;
  /** Key within that state definition, e.g. "showCardsCurrentTab". */
  key: string;
  /** Storage location the state was declared with. Defaults to disk. */
  location?: StorageLocation;
}

const DEFAULT_LOCATION: StorageLocation = "disk";
/** Automation reads raw JSON, so no domain deserialization is applied. */
const rawDeserializer = (value: unknown) => value;

/**
 * Reads arbitrary state by address, without the owning domain's key definition. Values come back as
 * the raw JSON held in storage — encrypted vault data stays encrypted.
 */
export class StateCapability {
  constructor(private stateProvider: StateProvider) {}

  /** Read a global state value. */
  async readGlobal(address: StateAddress): Promise<unknown> {
    const definition = new KeyDefinition<unknown>(this.stateDefinition(address), address.key, {
      deserializer: rawDeserializer,
    });

    return await firstValueFrom(this.stateProvider.getGlobal(definition).state$);
  }

  /** Read a state value belonging to a specific user. */
  async readUser(userId: UserId, address: StateAddress): Promise<unknown> {
    const definition = new UserKeyDefinition<unknown>(this.stateDefinition(address), address.key, {
      deserializer: rawDeserializer,
      clearOn: [],
    });

    return await firstValueFrom(this.stateProvider.getUser(userId, definition).state$);
  }

  private stateDefinition(address: StateAddress): StateDefinition {
    return new StateDefinition(address.stateName, address.location ?? DEFAULT_LOCATION);
  }
}
