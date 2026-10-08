import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";

import { ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import {
  AUTOFILL_SETTINGS_DISK,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/state";

import {
  AgentFillConnectionView,
  CreatedAgentFillConnection,
  MAX_CONNECTION_NAME_LENGTH,
} from "../models/agent-fill-connection";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

/** A saved connection. Only the key's hash is stored, never the key. */
type StoredAgentFillConnection = {
  id: string;
  name: string;
  /** Hex SHA-256 of the connection key. */
  keyHash: string;
  createdDate: string;
  paused: boolean;
};

export const AGENT_FILL_CONNECTIONS = new KeyDefinition<StoredAgentFillConnection[]>(
  AUTOFILL_SETTINGS_DISK,
  "agentFillConnections",
  {
    deserializer: (value) => value,
  },
);

/** 32 random bytes, which is 43 characters once base64url-encoded. */
const CONNECTION_KEY_BYTES = 32;

/**
 * The agent connections saved on this computer. The hub reads them on every fill call, and the
 * "Agent connections" list in Settings manages them through the preload channels.
 *
 * Keys are generated here and returned once; only their SHA-256 hash is saved.
 */
export class AgentFillConnectionsService {
  private readonly state: GlobalState<StoredAgentFillConnection[]>;

  constructor(stateProvider: StateProvider) {
    this.state = stateProvider.getGlobal(AGENT_FILL_CONNECTIONS);

    ipcMain.handle(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_LIST, () => this.list());
    ipcMain.handle(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_CREATE, (_event, name: unknown) =>
      this.create(name),
    );
    ipcMain.handle(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_PAUSE, (_event, id: unknown) =>
      this.setPaused(id, true),
    );
    ipcMain.handle(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_RESUME, (_event, id: unknown) =>
      this.setPaused(id, false),
    );
    ipcMain.handle(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_REMOVE, (_event, id: unknown) =>
      this.remove(id),
    );
  }

  async list(): Promise<AgentFillConnectionView[]> {
    return ((await firstValueFrom(this.state.state$)) ?? []).map(toView);
  }

  /**
   * Saves a new connection and returns its key. This is the only time the key exists outside the
   * connector; the caller shows it to the user once.
   */
  async create(name: unknown): Promise<CreatedAgentFillConnection> {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("A connection needs a name.");
    }
    const trimmed = name.trim();
    if (trimmed.length > MAX_CONNECTION_NAME_LENGTH) {
      throw new Error("The connection name is too long.");
    }

    const key = randomBytes(CONNECTION_KEY_BYTES).toString("base64url");
    const connection: StoredAgentFillConnection = {
      id: randomUUID(),
      name: trimmed,
      keyHash: hashKey(key),
      createdDate: new Date().toISOString(),
      paused: false,
    };
    await this.state.update((connections) => [...(connections ?? []), connection]);

    return { connection: toView(connection), key };
  }

  /**
   * Finds the connection a key belongs to. Every saved hash is compared, so the time taken does not
   * reveal how many or which ones match.
   */
  async findByKey(key: unknown): Promise<AgentFillConnectionView | null> {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }
    const digest = Buffer.from(hashKey(key), "hex");
    let found: StoredAgentFillConnection | null = null;
    for (const connection of (await firstValueFrom(this.state.state$)) ?? []) {
      if (timingSafeEqual(digest, Buffer.from(connection.keyHash, "hex")) && found == null) {
        found = connection;
      }
    }
    return found != null ? toView(found) : null;
  }

  async get(id: string): Promise<AgentFillConnectionView | null> {
    const connection = ((await firstValueFrom(this.state.state$)) ?? []).find((c) => c.id === id);
    return connection != null ? toView(connection) : null;
  }

  async setPaused(id: unknown, paused: boolean): Promise<void> {
    if (typeof id !== "string") {
      return;
    }
    await this.state.update((connections) =>
      (connections ?? []).map((c) => (c.id === id ? { ...c, paused } : c)),
    );
  }

  async remove(id: unknown): Promise<void> {
    if (typeof id !== "string") {
      return;
    }
    await this.state.update((connections) => (connections ?? []).filter((c) => c.id !== id));
  }
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function toView({ id, name, createdDate, paused }: StoredAgentFillConnection) {
  return { id, name, createdDate, paused } satisfies AgentFillConnectionView;
}
