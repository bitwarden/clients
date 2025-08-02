// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { StorageServiceProvider, StorageLocation } from "@bitwarden/storage-core";
import { UserId } from "@bitwarden/user-core";

import { GlobalState } from "./global-state";
import { GlobalStateProvider } from "./global-state.provider";
import { StateDefinition } from "./state-definition";
import {
  STATE_LOCK_EVENT,
  STATE_LOGOUT_EVENT,
  StateEventInfo,
} from "./state-event-registrar.service";
import { ClearEvent, UserKeyDefinition } from "./user-key-definition";

export class StateEventRunnerService {
  private readonly stateEventMap: { [Prop in ClearEvent]: GlobalState<StateEventInfo[]> };

  constructor(
    globalStateProvider: GlobalStateProvider,
    private storageServiceProvider: StorageServiceProvider,
  ) {
    this.stateEventMap = {
      lock: globalStateProvider.get(STATE_LOCK_EVENT),
      logout: globalStateProvider.get(STATE_LOGOUT_EVENT),
    };
  }

  async handleEvent(event: ClearEvent, userId: UserId) {
    let tickets = await firstValueFrom(this.stateEventMap[event].state$);
    tickets ??= [];

    const failures: string[] = [];

    for (const ticket of tickets) {
      try {
        const [, service] = this.storageServiceProvider.get(
          ticket.location,
          {}, // The storage location is already the computed storage location for this client
        );

        const ticketStorageKey = this.storageKeyFor(userId, ticket);

        // Evaluate current value so we can avoid writing to state if we don't need to
        const currentValue = await service.get(ticketStorageKey);
        if (currentValue != null) {
          await service.remove(ticketStorageKey);
        }
      } catch (err: unknown) {
        let errorMessage = "Unknown Error";
        if (typeof err === "object" && "message" in err && typeof err.message === "string") {
          errorMessage = err.message;
        }

        failures.push(
          `${errorMessage} in ${ticket.state} > ${ticket.key} located ${ticket.location}`,
        );
      }
    }

    if (failures.length > 0) {
      // Throw aggregated error
      throw new Error(
        `One or more errors occurred while handling event '${event}' for user ${userId}.\n${failures.join("\n")}`,
      );
    }
  }

  private storageKeyFor(userId: UserId, ticket: StateEventInfo) {
    const userKey = new UserKeyDefinition<unknown>(
      new StateDefinition(ticket.state, ticket.location as unknown as StorageLocation),
      ticket.key,
      {
        deserializer: (v) => v,
        clearOn: [],
      },
    );
    return userKey.buildKey(userId);
  }
}
