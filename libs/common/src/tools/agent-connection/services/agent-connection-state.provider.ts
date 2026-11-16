// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom } from "rxjs";

import { ActiveUserState, CombinedState, StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { AgentConnectionData } from "../models/data/agent-connection.data";

import { AgentConnectionStateProvider as AgentConnectionStateProviderAbstraction } from "./agent-connection-state.provider.abstraction";
import { AGENT_CONNECTION_USER_ENCRYPTED } from "./key-definitions";

/** State provider for agent connections. */
export class AgentConnectionStateProvider implements AgentConnectionStateProviderAbstraction {
  encryptedState$: Observable<CombinedState<Record<string, AgentConnectionData>>>;

  private activeUserEncryptedState: ActiveUserState<Record<string, AgentConnectionData>>;

  constructor(protected stateProvider: StateProvider) {
    this.activeUserEncryptedState = this.stateProvider.getActive(AGENT_CONNECTION_USER_ENCRYPTED);
    this.encryptedState$ = this.activeUserEncryptedState.combinedState$;
  }

  async getEncryptedAgentConnections(): Promise<
    CombinedState<Record<string, AgentConnectionData>>
  > {
    return await firstValueFrom(this.encryptedState$);
  }

  async setEncryptedAgentConnections(
    value: Record<string, AgentConnectionData>,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, AGENT_CONNECTION_USER_ENCRYPTED).update(() => value);
  }
}
