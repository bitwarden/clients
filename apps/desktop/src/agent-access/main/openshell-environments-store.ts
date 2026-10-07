import { promises as fs } from "fs";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  cleanOpenShellPurpose,
  isOpenShellMetaColor,
  OPENSHELL_MAX_ENVIRONMENTS,
  OPENSHELL_MAX_SANDBOX_META,
  OPENSHELL_MAX_SECRET_SETS,
  OpenShellEnvironment,
  OpenShellSandboxMeta,
  OpenShellSecretSet,
  parseOpenShellEnvironmentBody,
  parseOpenShellSecretRefs,
  cleanOpenShellDisplayText,
  OPENSHELL_MAX_NAME_CHARS,
} from "../models/openshell-environments";
import { isOpenShellResourceName, isOpenShellVaultId } from "../models/openshell-management";

import { nodeAtomicWriteOps, writeFileAtomicNoFollow } from "./openshell-atomic-write";

/** A few hundred entries of ids and short text; anything past this is not ours. */
const MAX_STORE_BYTES = 2 * 1024 * 1024;
const STORE_FILENAME = "openshell-environments.json";
const STORE_VERSION = 1;

/** Everything this app keeps for one gateway. */
export interface OpenShellGatewayData {
  environments: OpenShellEnvironment[];
  secretSets: OpenShellSecretSet[];
  /** Keyed by sandbox name. */
  sandboxMeta: Record<string, OpenShellSandboxMeta>;
}

/** The only filesystem operations the store performs, on its one JSON file. Injected for tests. */
export interface OpenShellEnvironmentsStoreFs {
  /** The file's text, `null` when it doesn't exist; throws for any other failure or when larger
   *  than `maxBytes`. */
  read(filePath: string, maxBytes: number): Promise<string | null>;
  /** Replaces `filePath` with `content` atomically (temp file, then rename). */
  writeAtomic(filePath: string, content: string): Promise<void>;
}

const nodeFs: OpenShellEnvironmentsStoreFs = {
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
    // 0o600 always; refuses to write through a symlink.
    await writeFileAtomicNoFollow(nodeAtomicWriteOps, filePath, content, 0o600, false);
  },
};

function emptyGateway(): OpenShellGatewayData {
  return { environments: [], secretSets: [], sandboxMeta: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseSet(value: unknown): OpenShellSecretSet | null {
  if (!isRecord(value) || !isOpenShellVaultId(value.id) || typeof value.name !== "string") {
    return null;
  }
  const name = cleanOpenShellDisplayText(value.name, OPENSHELL_MAX_NAME_CHARS);
  const secrets = parseOpenShellSecretRefs(value.secrets);
  return name === "" || secrets == null ? null : { id: value.id, name, secrets };
}

function parseEnvironment(value: unknown): OpenShellEnvironment | null {
  if (!isRecord(value) || !isOpenShellVaultId(value.id)) {
    return null;
  }
  const body = parseOpenShellEnvironmentBody(value);
  return body == null ? null : { id: value.id, ...body };
}

function parseMeta(name: string, value: unknown): OpenShellSandboxMeta | null {
  if (!isOpenShellResourceName(name) || !isRecord(value)) {
    return null;
  }
  const purpose = typeof value.purpose === "string" ? cleanOpenShellPurpose(value.purpose) : "";
  const color = isOpenShellMetaColor(value.color) ? value.color : null;
  return purpose === "" && color == null ? null : { name, purpose, color };
}

function parseGateway(value: unknown): OpenShellGatewayData {
  const data = emptyGateway();
  if (!isRecord(value)) {
    return data;
  }
  if (Array.isArray(value.environments)) {
    data.environments = value.environments
      .map(parseEnvironment)
      .filter((e): e is OpenShellEnvironment => e != null)
      .slice(0, OPENSHELL_MAX_ENVIRONMENTS);
  }
  if (Array.isArray(value.secretSets)) {
    data.secretSets = value.secretSets
      .map(parseSet)
      .filter((s): s is OpenShellSecretSet => s != null)
      .slice(0, OPENSHELL_MAX_SECRET_SETS);
  }
  if (isRecord(value.sandboxMeta)) {
    for (const [name, raw] of Object.entries(value.sandboxMeta).slice(
      0,
      OPENSHELL_MAX_SANDBOX_META,
    )) {
      const meta = parseMeta(name, raw);
      if (meta != null) {
        data.sandboxMeta[name] = meta;
      }
    }
  }
  return data;
}

/**
 * Main's own record of environments, secret sets and sandbox metadata (§M8.20 rule 17), one JSON
 * file under `userData`, keyed by gateway name. Ids, names and display text only.
 *
 * Reads are tolerant: a missing, oversized or corrupt file is an empty store (with a warning),
 * never an exception, and each entry is re-validated on load. Writes are atomic and serialized; a
 * failed write reports `false` and leaves the in-memory view unchanged. Callers get copies.
 */
export class OpenShellEnvironmentsStore {
  private gateways: Record<string, OpenShellGatewayData> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;

  constructor(
    private logService: LogService,
    userDataPath: string,
    private fsAdapter: OpenShellEnvironmentsStoreFs = nodeFs,
  ) {
    this.filePath = path.join(userDataPath, STORE_FILENAME);
  }

  /** A copy of the gateway's data (empty when it has none). */
  async read(gatewayName: string): Promise<OpenShellGatewayData> {
    return this.serialized(async () => clone((await this.load())[gatewayName] ?? emptyGateway()));
  }

  /**
   * Runs `change` on a copy of the gateway's data. When it returns `true` the copy is written
   * atomically and becomes current. Resolves to `"written"`, `"unchanged"` (the callback declined)
   * or `"failed"` (the write failed; nothing changed).
   */
  async update(
    gatewayName: string,
    change: (data: OpenShellGatewayData) => boolean,
  ): Promise<"written" | "unchanged" | "failed"> {
    return this.serialized(async () => {
      if (!isOpenShellResourceName(gatewayName)) {
        return "failed";
      }
      const all = await this.load();
      const draft = clone(all[gatewayName] ?? emptyGateway());
      if (!change(draft)) {
        return "unchanged";
      }
      return (await this.commit({ ...all, [gatewayName]: draft })) ? "written" : "failed";
    });
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((): void => undefined);
    return run;
  }

  private async load(): Promise<Record<string, OpenShellGatewayData>> {
    if (this.gateways != null) {
      return this.gateways;
    }
    let loaded: Record<string, OpenShellGatewayData> = {};
    try {
      const text = await this.fsAdapter.read(this.filePath, MAX_STORE_BYTES);
      if (text != null) {
        const parsed: unknown = JSON.parse(text);
        const list = isRecord(parsed) ? parsed.gateways : null;
        if (!isRecord(list)) {
          throw new Error("unexpected shape");
        }
        for (const [name, value] of Object.entries(list)) {
          if (isOpenShellResourceName(name)) {
            loaded[name] = parseGateway(value);
          }
        }
      }
    } catch (e) {
      this.logService.warning(
        `[Agent Access] OpenShell environments store is unreadable and was treated as empty: ${e}`,
      );
      loaded = {};
    }
    this.gateways = loaded;
    return loaded;
  }

  private async commit(next: Record<string, OpenShellGatewayData>): Promise<boolean> {
    try {
      await this.fsAdapter.writeAtomic(
        this.filePath,
        JSON.stringify({ version: STORE_VERSION, gateways: next }, null, 2),
      );
      this.gateways = next;
      return true;
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell environments store write failed: ${e}`);
      return false;
    }
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
