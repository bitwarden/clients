import { PossibleLocation, StorageServiceProvider } from "@bitwarden/storage-core";

import { GlobalState } from "./global-state";
import { GlobalStateProvider } from "./global-state.provider";
import { KeyDefinition } from "./key-definition";
import { CLEAR_EVENT_DISK } from "./state-definitions";
import { ClearEvent, UserKeyDefinition } from "./user-key-definition";

export type StateEventInfo = {
  state: string;
  key: string;
  location: PossibleLocation;
};

export const STATE_LOCK_EVENT = KeyDefinition.array<StateEventInfo>(CLEAR_EVENT_DISK, "lock", {
  deserializer: (e) => e,
});

export const STATE_LOGOUT_EVENT = KeyDefinition.array<StateEventInfo>(CLEAR_EVENT_DISK, "logout", {
  deserializer: (e) => e,
});

export class StateEventRegistrarService {
  private readonly stateEventStateMap: { [Prop in ClearEvent]: GlobalState<StateEventInfo[]> };

  constructor(
    globalStateProvider: GlobalStateProvider,
    private storageServiceProvider: StorageServiceProvider,
  ) {
    this.stateEventStateMap = {
      lock: globalStateProvider.get(STATE_LOCK_EVENT),
      logout: globalStateProvider.get(STATE_LOGOUT_EVENT),
    };
  }

  async registerEvents(keyDefinition: UserKeyDefinition<unknown>) {
    for (const clearEvent of keyDefinition.clearOn) {
      const eventState = this.stateEventStateMap[clearEvent];
      // Determine the storage location for this
      const [storageLocation] = this.storageServiceProvider.get(
        keyDefinition.stateDefinition.defaultStorageLocation,
        keyDefinition.stateDefinition.storageLocationOverrides,
      );

      const newEvent: StateEventInfo = {
        state: keyDefinition.stateDefinition.name,
        key: keyDefinition.key,
        location: storageLocation,
      };

      // Only update the event state if the existing list doesn't have a matching entry
      await eventState.update(
        (existingTickets) => {
          existingTickets ??= [];
          existingTickets.push(newEvent);
          return existingTickets;
        },
        {
          shouldUpdate: (currentTickets) => {
            return (
              // If the current tickets are null, then it will for sure be added
              currentTickets == null ||
              // If an existing match couldn't be found, we also need to add one
              currentTickets.findIndex(
                (e) =>
                  e.state === newEvent.state &&
                  e.key === newEvent.key &&
                  e.location === newEvent.location,
              ) === -1
            );
          },
        },
      );
    }
  }
}
