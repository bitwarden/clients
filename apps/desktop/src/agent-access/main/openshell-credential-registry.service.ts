import { promises as fs } from "fs";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  buildBitwardenReference,
  isOpenShellEnvVarName,
  isOpenShellResourceName,
  OpenShellManagedBinding,
} from "../models/openshell-management";

import { nodeAtomicWriteOps, writeFileAtomicNoFollow } from "./openshell-atomic-write";

/** The record is a few hundred bytes per credential; anything past this is not ours. */
const MAX_REGISTRY_BYTES = 1024 * 1024;
const REGISTRY_FILENAME = "openshell-credentials.json";
const REGISTRY_VERSION = 1;

/**
 * What this app recorded when it created a provider (§M8.20 rule 3). Ids, names and env-var names
 * only: never a credential value and never a `bw://` reference string.
 */
export interface OpenShellRegistryEntry {
  /** The gateway the provider was created on. An entry from an older file has none (`""`) and
   *  matches no gateway: it is unmanaged for everything (fail closed). */
  gatewayName: string;
  sandboxName: string;
  providerName: string;
  profileId: string;
  bindings: OpenShellManagedBinding[];
  createdAtMs: number;
}

/**
 * The only filesystem operations the registry performs, on its one JSON file. Injected so tests
 * never touch a real file.
 */
export interface OpenShellCredentialRegistryFs {
  /** The file's text, `null` when it doesn't exist; throws for any other failure or when larger
   *  than `maxBytes`. */
  read(filePath: string, maxBytes: number): Promise<string | null>;
  /** Replaces `filePath` with `content` atomically (write a sibling temp file, then rename). */
  writeAtomic(filePath: string, content: string): Promise<void>;
}

const nodeFs: OpenShellCredentialRegistryFs = {
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

/** Bidi controls, zero-width characters and the BOM: they can reorder or hide display text. */
const INVISIBLE_FORMATTING = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const MAX_LABEL_CHARS = 120;

/** Display text only: control, bidi-control and zero-width characters removed, trimmed, capped. */
export function cleanOpenShellText(text: string, maxChars: number): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .replace(INVISIBLE_FORMATTING, "")
      .trim()
      .slice(0, maxChars)
  );
}

export function cleanOpenShellLabel(label: string): string {
  return cleanOpenShellText(label, MAX_LABEL_CHARS);
}

/** An entry with no valid gateway name never matches, so it is unmanaged everywhere. */
function matchesSandbox(
  entry: OpenShellRegistryEntry,
  gatewayName: string,
  sandboxName: string,
): boolean {
  return (
    isOpenShellResourceName(gatewayName) &&
    entry.gatewayName === gatewayName &&
    entry.sandboxName === sandboxName
  );
}

function cleanBinding(binding: OpenShellManagedBinding): OpenShellManagedBinding {
  return { ...binding, label: cleanOpenShellLabel(binding.label) };
}

function clone(entry: OpenShellRegistryEntry): OpenShellRegistryEntry {
  return JSON.parse(JSON.stringify(entry));
}

function parseBinding(value: unknown): OpenShellManagedBinding | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isOpenShellEnvVarName(raw.envVar) || typeof raw.label !== "string") {
    return null;
  }
  const binding = {
    envVar: raw.envVar,
    resourceType: raw.resourceType,
    id: raw.id,
    field: raw.field,
  } as OpenShellManagedBinding;
  if (buildBitwardenReference(binding) == null) {
    return null;
  }
  return { ...binding, label: cleanOpenShellLabel(raw.label) };
}

function parseEntry(value: unknown): OpenShellRegistryEntry | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    !isOpenShellResourceName(raw.sandboxName) ||
    !isOpenShellResourceName(raw.providerName) ||
    !isOpenShellResourceName(raw.profileId) ||
    !Array.isArray(raw.bindings) ||
    typeof raw.createdAtMs !== "number" ||
    !Number.isFinite(raw.createdAtMs)
  ) {
    return null;
  }
  const bindings = raw.bindings.map(parseBinding);
  if (bindings.some((binding) => binding == null)) {
    return null;
  }
  return {
    gatewayName: isOpenShellResourceName(raw.gatewayName) ? raw.gatewayName : "",
    sandboxName: raw.sandboxName,
    providerName: raw.providerName,
    profileId: raw.profileId,
    bindings: bindings as OpenShellManagedBinding[],
    createdAtMs: raw.createdAtMs,
  };
}

/**
 * Main's own record of the providers this app created for OpenShell sandboxes (§M8.20 rule 3). The
 * gateway strips the vault reference when it reports a provider back, so this file is the only way
 * to show which vault item a credential points at, and to tell a provider this app may delete from
 * one it must never touch.
 *
 * Reads are tolerant: a missing, oversized or corrupt file is an empty registry (with a warning),
 * never an exception. Writes are atomic and serialized; a failed write reports `false` and leaves
 * the in-memory view unchanged.
 */
export class OpenShellCredentialRegistryService {
  private entries: OpenShellRegistryEntry[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;

  constructor(
    private logService: LogService,
    userDataPath: string,
    private fsAdapter: OpenShellCredentialRegistryFs = nodeFs,
  ) {
    this.filePath = path.join(userDataPath, REGISTRY_FILENAME);
  }

  async getForSandbox(gatewayName: string, sandboxName: string): Promise<OpenShellRegistryEntry[]> {
    return this.serialized(async () =>
      (await this.load())
        .filter((entry) => matchesSandbox(entry, gatewayName, sandboxName))
        .map((entry) => clone(entry)),
    );
  }

  async isManaged(
    gatewayName: string,
    sandboxName: string,
    providerName: string,
  ): Promise<boolean> {
    return this.serialized(async () =>
      (await this.load()).some(
        (entry) =>
          matchesSandbox(entry, gatewayName, sandboxName) && entry.providerName === providerName,
      ),
    );
  }

  /** Adds or replaces the entry for `(gatewayName, sandboxName, providerName)`. `false` when it
   *  couldn't be saved, or when the entry has no valid gateway name. */
  async upsert(entry: OpenShellRegistryEntry): Promise<boolean> {
    return this.serialized(async () => {
      if (!isOpenShellResourceName(entry.gatewayName)) {
        return false;
      }
      const current = await this.load();
      return this.commit([
        ...current.filter(
          (existing) =>
            !(
              matchesSandbox(existing, entry.gatewayName, entry.sandboxName) &&
              existing.providerName === entry.providerName
            ),
        ),
        clone({ ...entry, bindings: entry.bindings.map(cleanBinding) }),
      ]);
    });
  }

  async removeProvider(
    gatewayName: string,
    sandboxName: string,
    providerName: string,
  ): Promise<boolean> {
    return this.removeWhere(
      (entry) =>
        matchesSandbox(entry, gatewayName, sandboxName) && entry.providerName === providerName,
    );
  }

  /** Drops every entry of a sandbox (on that gateway) that no longer exists. */
  async removeSandbox(gatewayName: string, sandboxName: string): Promise<boolean> {
    return this.removeWhere((entry) => matchesSandbox(entry, gatewayName, sandboxName));
  }

  private removeWhere(predicate: (entry: OpenShellRegistryEntry) => boolean): Promise<boolean> {
    return this.serialized(async () => {
      const current = await this.load();
      const next = current.filter((entry) => !predicate(entry));
      if (next.length === current.length) {
        return true;
      }
      return this.commit(next);
    });
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((): void => undefined);
    return run;
  }

  private async load(): Promise<OpenShellRegistryEntry[]> {
    if (this.entries != null) {
      return this.entries;
    }
    let loaded: OpenShellRegistryEntry[] = [];
    try {
      const text = await this.fsAdapter.read(this.filePath, MAX_REGISTRY_BYTES);
      if (text != null) {
        const parsed: unknown = JSON.parse(text);
        const list = (parsed as { entries?: unknown } | null)?.entries;
        if (!Array.isArray(list)) {
          throw new Error("unexpected shape");
        }
        loaded = list
          .map(parseEntry)
          .filter((entry): entry is OpenShellRegistryEntry => entry != null);
      }
    } catch (e) {
      this.logService.warning(
        `[Agent Access] OpenShell credential registry is unreadable and was treated as empty: ${e}`,
      );
      loaded = [];
    }
    this.entries = loaded;
    return loaded;
  }

  private async commit(next: OpenShellRegistryEntry[]): Promise<boolean> {
    try {
      await this.fsAdapter.writeAtomic(
        this.filePath,
        JSON.stringify({ version: REGISTRY_VERSION, entries: next }, null, 2),
      );
      this.entries = next;
      return true;
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell credential registry write failed: ${e}`);
      return false;
    }
  }
}
