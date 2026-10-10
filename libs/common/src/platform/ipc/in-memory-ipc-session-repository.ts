import { Endpoint, IpcSessionRepository as SdkIpcSessionRepository } from "@bitwarden/sdk-internal";

import { endpointToString } from "./ipc-session-repository";

/**
 * In-memory implementation of the SDK session repository. Unlike the SDK's internal in-memory
 * sessions, transports can call {@link remove} to drop a session when a peer disconnects.
 */
export class InMemoryIpcSessionRepository implements SdkIpcSessionRepository {
  private sessions = new Map<string, any>();

  async get(endpoint: Endpoint): Promise<any | undefined> {
    return this.sessions.get(endpointToString(endpoint));
  }

  async save(endpoint: Endpoint, session: any): Promise<void> {
    this.sessions.set(endpointToString(endpoint), session);
  }

  async remove(endpoint: Endpoint): Promise<void> {
    this.sessions.delete(endpointToString(endpoint));
  }
}
