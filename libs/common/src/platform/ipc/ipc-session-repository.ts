import { firstValueFrom, map } from "rxjs";

import { Endpoint, IpcSessionRepository as SdkIpcSessionRepository } from "@bitwarden/sdk-internal";

import { GlobalState, IPC_MEMORY, KeyDefinition, StateProvider } from "../state";

const IPC_SESSIONS = KeyDefinition.record<object, string>(IPC_MEMORY, "ipcSessions", {
  deserializer: (value: object) => value,
});

/**
 * Implementation of SDK-defined repository interface/trait. Do not use directly.
 * All error handling is done by the caller (the SDK).
 * For more information see IPC docs.
 *
 * Interface uses `any` type as defined by the SDK until we get a concrete session type.
 */
export class IpcSessionRepository implements SdkIpcSessionRepository {
  private states: GlobalState<Record<string, any>>;

  constructor(private stateProvider: StateProvider) {
    this.states = this.stateProvider.getGlobal(IPC_SESSIONS);
  }

  get(endpoint: Endpoint): Promise<any | undefined> {
    return firstValueFrom(this.states.state$.pipe(map((s) => s?.[endpointToString(endpoint)])));
  }

  async save(endpoint: Endpoint, session: any): Promise<void> {
    await this.states.update((s) => ({
      ...s,
      [endpointToString(endpoint)]: session,
    }));
  }

  async remove(endpoint: Endpoint): Promise<void> {
    await this.states.update((s) => {
      const newState = { ...s };
      delete newState[endpointToString(endpoint)];
      return newState;
    });
  }
}

function endpointToString(endpoint: Endpoint): string {
  if (typeof endpoint === "object" && "Web" in endpoint) {
    return `Web(${endpoint.Web.id})`;
  }

  return endpoint;
}
