import { promises as fs } from "fs";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { isOpenShellPort, isOpenShellResourceName } from "../models/openshell-management";
import {
  OPENSHELL_MAX_PORT_NAME_CHARS,
  OPENSHELL_MAX_SAVED_PORTS,
  OpenShellSavedPort,
} from "../models/openshell-ports";

import { nodeAtomicWriteOps, writeFileAtomicNoFollow } from "./openshell-atomic-write";
import { cleanOpenShellText } from "./openshell-credential-registry.service";

const MAX_FILE_BYTES = 1024 * 1024;
const FILENAME = "openshell-saved-ports.json";
const FILE_VERSION = 1;
/** Bound on the whole file so it cannot grow without limit across many sandboxes. */
const MAX_TOTAL_ENTRIES = 500;

interface SavedPortsEntry {
  gatewayName: string;
  sandboxName: string;
  ports: OpenShellSavedPort[];
}

/** The only filesystem operations the store performs, on its one JSON file. */
export interface OpenShellSavedPortsFs {
  read(filePath: string, maxBytes: number): Promise<string | null>;
  writeAtomic(filePath: string, content: string): Promise<void>;
}

const nodeFs: OpenShellSavedPortsFs = {
  async read(filePath, maxBytes) {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > maxBytes) {
        throw new Error("not a regular file of reasonable size");
      }
      return await fs.readFile(filePath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw e;
    }
  },
  async writeAtomic(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await writeFileAtomicNoFollow(nodeAtomicWriteOps, filePath, content, 0o600, false);
  },
};

/**
 * Cleans a list for storing: valid ports only, no duplicates (the first one wins), names cleaned
 * like labels and capped, at most `OPENSHELL_MAX_SAVED_PORTS`. Anything else is dropped.
 */
export function cleanOpenShellSavedPorts(value: unknown): OpenShellSavedPort[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<number>();
  const cleaned: OpenShellSavedPort[] = [];
  for (const item of value) {
    if (item == null || typeof item !== "object" || !isOpenShellPort((item as any).port)) {
      continue;
    }
    const { port, name } = item as { port: number; name?: unknown };
    if (seen.has(port)) {
      continue;
    }
    seen.add(port);
    cleaned.push({
      port,
      name: typeof name === "string" ? cleanOpenShellText(name, OPENSHELL_MAX_PORT_NAME_CHARS) : "",
    });
    if (cleaned.length >= OPENSHELL_MAX_SAVED_PORTS) {
      break;
    }
  }
  return cleaned;
}

/**
 * The user's saved ports per gateway and sandbox (§M8.20 rule 15). A port number and an optional
 * friendly name only: no secret, no URL. Reads are tolerant (a missing, oversized or corrupt file
 * is an empty store, with a warning); writes are atomic, serialized and `0600`, and refuse to
 * write through a symlink. A failed write returns `false` and leaves the in-memory view unchanged.
 */
export class OpenShellSavedPortsService {
  private entries: SavedPortsEntry[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;

  constructor(
    private logService: LogService,
    userDataPath: string,
    private fsAdapter: OpenShellSavedPortsFs = nodeFs,
  ) {
    this.filePath = path.join(userDataPath, FILENAME);
  }

  async get(gatewayName: string, sandboxName: string): Promise<OpenShellSavedPort[]> {
    if (!isOpenShellResourceName(gatewayName) || !isOpenShellResourceName(sandboxName)) {
      return [];
    }
    return this.serialized(async () => {
      const entry = (await this.load()).find(
        (e) => e.gatewayName === gatewayName && e.sandboxName === sandboxName,
      );
      return entry == null ? [] : entry.ports.map((p) => ({ ...p }));
    });
  }

  /** Replaces the sandbox's list with the cleaned `ports` and returns what was stored, or `null`
   *  when it could not be saved. An empty list removes the sandbox's entry. */
  async set(
    gatewayName: string,
    sandboxName: string,
    ports: unknown,
  ): Promise<OpenShellSavedPort[] | null> {
    if (!isOpenShellResourceName(gatewayName) || !isOpenShellResourceName(sandboxName)) {
      return null;
    }
    const cleaned = cleanOpenShellSavedPorts(ports);
    return this.serialized(async () => {
      const others = (await this.load()).filter(
        (e) => !(e.gatewayName === gatewayName && e.sandboxName === sandboxName),
      );
      const next =
        cleaned.length === 0 ? others : [...others, { gatewayName, sandboxName, ports: cleaned }];
      if (next.length > MAX_TOTAL_ENTRIES) {
        return null;
      }
      return (await this.commit(next)) ? cleaned.map((p) => ({ ...p })) : null;
    });
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((): void => undefined);
    return run;
  }

  private async load(): Promise<SavedPortsEntry[]> {
    if (this.entries != null) {
      return this.entries;
    }
    let loaded: SavedPortsEntry[] = [];
    try {
      const text = await this.fsAdapter.read(this.filePath, MAX_FILE_BYTES);
      if (text != null) {
        const list = (JSON.parse(text) as { entries?: unknown } | null)?.entries;
        if (!Array.isArray(list)) {
          throw new Error("unexpected shape");
        }
        for (const raw of list) {
          const entry = raw as Record<string, unknown> | null;
          if (
            entry != null &&
            isOpenShellResourceName(entry.gatewayName) &&
            isOpenShellResourceName(entry.sandboxName)
          ) {
            const ports = cleanOpenShellSavedPorts(entry.ports);
            if (ports.length > 0) {
              loaded.push({
                gatewayName: entry.gatewayName as string,
                sandboxName: entry.sandboxName as string,
                ports,
              });
            }
          }
        }
        loaded = loaded.slice(0, MAX_TOTAL_ENTRIES);
      }
    } catch (e) {
      this.logService.warning(
        `[Agent Access] OpenShell saved ports are unreadable and were treated as empty: ${e}`,
      );
      loaded = [];
    }
    this.entries = loaded;
    return loaded;
  }

  private async commit(next: SavedPortsEntry[]): Promise<boolean> {
    try {
      await this.fsAdapter.writeAtomic(
        this.filePath,
        JSON.stringify({ version: FILE_VERSION, entries: next }, null, 2),
      );
      this.entries = next;
      return true;
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell saved ports write failed: ${e}`);
      return false;
    }
  }
}
