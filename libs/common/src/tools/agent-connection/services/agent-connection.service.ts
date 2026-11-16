// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, concatMap, firstValueFrom, map } from "rxjs";

// This import may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AgentConnectionData } from "../models/data/agent-connection.data";
import { AgentConnection } from "../models/domain/agent-connection";
import { AgentConnectionWithIdRequest } from "../models/request/agent-connection-with-id.request";
import { AgentConnectionView } from "../models/view/agent-connection.view";

import { AgentConnectionStateProvider } from "./agent-connection-state.provider.abstraction";
import { InternalAgentConnectionService as InternalAgentConnectionServiceAbstraction } from "./agent-connection.service.abstraction";

export class AgentConnectionService implements InternalAgentConnectionServiceAbstraction {
  agentConnections$: Observable<AgentConnection[]> = this.stateProvider.encryptedState$.pipe(
    map(([, record]) => Object.values(record ?? {}).map((data) => new AgentConnection(data))),
  );

  agentConnectionViews$: Observable<AgentConnectionView[]> =
    this.stateProvider.encryptedState$.pipe(
      concatMap(([userId, record]) =>
        this.decryptConnections(
          Object.values(record ?? {}).map((data) => new AgentConnection(data)),
          userId,
        ),
      ),
    );

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    private stateProvider: AgentConnectionStateProvider,
  ) {}

  async encrypt(
    partnerClientId: string,
    name: string,
    plaintextPsk: string,
    userId: UserId,
  ): Promise<AgentConnection> {
    if (!userId) {
      throw new Error("User ID is required to encrypt an agent connection.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("No user key found.");
    }

    const connection = new AgentConnection();
    connection.partnerClientId = partnerClientId;
    connection.name = name;
    connection.key = await this.encryptService.encryptString(plaintextPsk, userKey);
    return connection;
  }

  async upsert(connection: AgentConnectionData | AgentConnectionData[]): Promise<void> {
    const [userId, current] = await this.stateProvider.getEncryptedAgentConnections();
    const connections = current ?? {};
    if (Array.isArray(connection)) {
      connection.forEach((c) => (connections[c.id] = c));
    } else {
      connections[connection.id] = connection;
    }
    await this.replace(connections, userId);
  }

  async delete(id: string | string[]): Promise<void> {
    const [userId, connections] = await this.stateProvider.getEncryptedAgentConnections();
    if (connections == null) {
      return;
    }

    const ids = Array.isArray(id) ? id : [id];
    ids.forEach((i) => delete connections[i]);
    await this.replace(connections, userId);
  }

  async replace(connections: Record<string, AgentConnectionData>, userId: UserId): Promise<void> {
    await this.stateProvider.setEncryptedAgentConnections(connections, userId);
  }

  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<AgentConnectionWithIdRequest[]> {
    if (originalUserKey == null) {
      throw new Error("Original user key is required for rotation.");
    }
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    const connections = await firstValueFrom(this.agentConnections$);
    return await Promise.all(
      connections.map(async (connection) => {
        const psk = await this.encryptService.decryptString(connection.key, originalUserKey);
        const rotated = new AgentConnection(connection.toAgentConnectionData());
        rotated.key = await this.encryptService.encryptString(psk, newUserKey);
        return new AgentConnectionWithIdRequest(rotated);
      }),
    );
  }

  private async decryptConnections(
    connections: AgentConnection[],
    userId: UserId,
  ): Promise<AgentConnectionView[]> {
    if (!userId || connections.length === 0) {
      return [];
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return [];
    }

    const views = await Promise.all(
      connections.map((connection) => connection.decrypt(userKey, this.encryptService)),
    );
    return views.sort(Utils.getSortFunction(this.i18nService, "name"));
  }
}
