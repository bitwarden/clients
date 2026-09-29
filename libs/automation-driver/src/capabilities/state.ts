import {
  KeyDefinition,
  StateDefinition,
  StorageKey,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { globalKeyBuilder } from "@bitwarden/state-internal";
import { StorageLocation, StorageServiceProvider } from "@bitwarden/storage-core";

import { AutomationCapability } from "../automation-capability";

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
 *
 * Reads bypass the state providers on purpose: their caches are keyed by state name alone, so an
 * ad-hoc definition registered here would replace the owning domain's deserializer and `clearOn`
 * events for the rest of the process.
 */
export class StateCapability extends AutomationCapability {
  readonly automationName = "state";

  constructor(private storageServiceProvider: StorageServiceProvider) {
    super();
  }

  /** Read a global state value. */
  async readGlobal(address: StateAddress): Promise<unknown> {
    const definition = new KeyDefinition<unknown>(this.stateDefinition(address), address.key, {
      deserializer: rawDeserializer,
    });

    return await this.read(address, globalKeyBuilder(definition));
  }

  /** Read a state value belonging to a specific user. */
  async readUser(userId: UserId, address: StateAddress): Promise<unknown> {
    const definition = new UserKeyDefinition<unknown>(this.stateDefinition(address), address.key, {
      deserializer: rawDeserializer,
      clearOn: [],
    });

    return await this.read(address, definition.buildKey(userId));
  }

  private async read(address: StateAddress, storageKey: StorageKey): Promise<unknown> {
    const [, storageService] = this.storageServiceProvider.get(
      address.location ?? DEFAULT_LOCATION,
      {},
    );

    return (await storageService.get<unknown>(storageKey)) ?? null;
  }

  private stateDefinition(address: StateAddress): StateDefinition {
    return new StateDefinition(address.stateName, address.location ?? DEFAULT_LOCATION);
  }
}
