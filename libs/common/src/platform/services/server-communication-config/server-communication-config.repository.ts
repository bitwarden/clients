import { distinctUntilChanged, firstValueFrom, map, Observable } from "rxjs";

import {
  ServerCommunicationConfigRepository as SdkRepository,
  ServerCommunicationConfig,
} from "@bitwarden/sdk-internal";

import { GlobalState, StateProvider } from "../../state";

import { SERVER_COMMUNICATION_CONFIGS } from "./server-communication-config.state";

/**
 * Implementation of SDK-defined  interface.
 * Bridges the SDK's repository abstraction with StateProvider for persistence.
 *
 * This repository manages server communication configurations keyed by hostname,
 * storing information about bootstrap requirements (direct vs SSO cookie vendor)
 * for each server environment.
 *
 * @remarks
 * - Uses global state (application-level, not user-scoped)
 * - Configurations persist across sessions (stored on disk)
 * - Each hostname maintains independent configuration
 * - All error handling is performed by the SDK caller
 *
 */
export class ServerCommunicationConfigRepository implements SdkRepository {
  private state: GlobalState<Record<string, ServerCommunicationConfig>>;

  constructor(private stateProvider: StateProvider) {
    this.state = this.stateProvider.getGlobal(SERVER_COMMUNICATION_CONFIGS);
  }

  async get(hostname: string): Promise<ServerCommunicationConfig | undefined> {
    return firstValueFrom(this.get$(hostname));
  }

  /**
   * Observable that emits when the configuration for a specific hostname changes.
   *
   * @param hostname - The server hostname
   * @returns Observable that emits the config for the hostname, or undefined if not set
   */
  get$(hostname: string): Observable<ServerCommunicationConfig | undefined> {
    return this.state.state$.pipe(
      map((configs) => configs?.[hostname]),
      distinctUntilChanged(),
    );
  }

  async save(hostname: string, config: ServerCommunicationConfig): Promise<void> {
    await this.state.update((configs) => ({
      ...configs,
      [hostname]: config,
    }));
  }
}
