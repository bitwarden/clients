import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

/**
 * Session record as stored by the WASM SDK.
 * Field names use camelCase to match the Rust `#[serde(rename_all = "camelCase")]`.
 */
export interface SessionRecord {
  fingerprint: number[];
  name: string | null;
  createdAt: number;
  lastConnected: number;
  transportState: number[] | null;
}

const SESSIONS_KEY = "agent_access_sessions";

/**
 * Old connection entry format for migration.
 */
interface OldConnectionEntry {
  id: string;
  name: string;
  fingerprint: string;
  lastUsed: number;
  sessionData: string;
}

const OLD_CONNECTIONS_KEY = "agent_access_connections";

/**
 * Repository<SessionRecord> implementation backed by AbstractStorageService.
 *
 * Stores all sessions as a map keyed by hex fingerprint.
 * Implements the Repository interface expected by the WASM UserClient.
 */
export class ChromeSessionRepository {
  constructor(private storageService: AbstractStorageService) {}

  async get(id: string): Promise<SessionRecord | null> {
    const sessions = await this.getAll();
    return sessions[id] ?? null;
  }

  async list(): Promise<SessionRecord[]> {
    const sessions = await this.getAll();
    return Object.values(sessions);
  }

  async set(id: string, value: SessionRecord): Promise<void> {
    const sessions = await this.getAll();
    sessions[id] = value;
    await this.storageService.save(SESSIONS_KEY, sessions);
  }

  async setBulk(values: [string, SessionRecord][]): Promise<void> {
    const sessions = await this.getAll();
    for (const [id, value] of values) {
      sessions[id] = value;
    }
    await this.storageService.save(SESSIONS_KEY, sessions);
  }

  async remove(id: string): Promise<void> {
    const sessions = await this.getAll();
    delete sessions[id];
    await this.storageService.save(SESSIONS_KEY, sessions);
  }

  async removeBulk(keys: string[]): Promise<void> {
    const sessions = await this.getAll();
    for (const key of keys) {
      delete sessions[key];
    }
    await this.storageService.save(SESSIONS_KEY, sessions);
  }

  async removeAll(): Promise<void> {
    await this.storageService.save(SESSIONS_KEY, {});
  }

  /**
   * Migrate from old `agent_access_connections` format if present.
   * Old format stored ConnectionEntry[] with embedded sessionData JSON.
   * After migration, old key is removed.
   */
  async migrateFromOldFormat(): Promise<void> {
    const oldData = await this.storageService.get<OldConnectionEntry[] | string>(
      OLD_CONNECTIONS_KEY,
    );
    if (!oldData) {
      return;
    }

    let entries: OldConnectionEntry[];
    if (typeof oldData === "string") {
      try {
        entries = JSON.parse(oldData) as OldConnectionEntry[];
      } catch {
        await this.storageService.remove(OLD_CONNECTIONS_KEY);
        return;
      }
    } else if (Array.isArray(oldData)) {
      entries = oldData;
    } else {
      await this.storageService.remove(OLD_CONNECTIONS_KEY);
      return;
    }

    // Only migrate if we don't already have sessions in the new format
    const existing = await this.getAll();
    if (Object.keys(existing).length > 0) {
      await this.storageService.remove(OLD_CONNECTIONS_KEY);
      return;
    }

    // We can't reconstruct full SessionRecords from the old format because
    // the old sessionData JSON was in a different internal format.
    // However, we preserve the connection metadata (name, timestamps).
    // The session transport state will be re-established on next connection.
    const sessions: Record<string, SessionRecord> = {};
    for (const entry of entries) {
      if (!entry.id) {
        continue;
      }
      // Convert hex id back to fingerprint bytes
      const fpBytes = hexToBytes(entry.id);
      sessions[entry.id] = {
        fingerprint: Array.from(fpBytes),
        name: entry.name || null,
        createdAt: entry.lastUsed,
        lastConnected: entry.lastUsed,
        transportState: null, // Can't migrate transport state — will re-handshake
      };
    }

    await this.storageService.save(SESSIONS_KEY, sessions);
    await this.storageService.remove(OLD_CONNECTIONS_KEY);
  }

  private async getAll(): Promise<Record<string, SessionRecord>> {
    return (await this.storageService.get<Record<string, SessionRecord>>(SESSIONS_KEY)) ?? {};
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
