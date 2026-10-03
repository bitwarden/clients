import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import { Fingerprint, IdentityMetadata, MtlsConfiguration } from "../../models/mtls";

import { normalizeEndpoint } from "./endpoint";

const FINGERPRINT = /^[0-9a-f]{64}$/;
const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validIdentity(value: unknown, fingerprint: string): value is IdentityMetadata {
  if (!isRecord(value) || value.fingerprint !== fingerprint) {
    return false;
  }
  if (
    typeof value.label !== "string" ||
    value.label.length > 128 ||
    typeof value.subject !== "string" ||
    typeof value.issuer !== "string"
  ) {
    return false;
  }
  return [value.notBefore, value.notAfter, value.importedAt].every(
    (date) => typeof date === "string" && !Number.isNaN(Date.parse(date)),
  );
}

export function validateConfiguration(value: unknown): MtlsConfiguration {
  if (!isRecord(value) || value.version !== 1 || !Number.isSafeInteger(value.revision)) {
    throw new Error("store-corrupt");
  }
  if (
    (value.revision as number) < 0 ||
    typeof value.storeId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.storeId) ||
    !isRecord(value.identities) ||
    !isRecord(value.bindings) ||
    !Array.isArray(value.cleanup)
  ) {
    throw new Error("store-corrupt");
  }
  for (const [fingerprint, identity] of Object.entries(value.identities)) {
    if (!FINGERPRINT.test(fingerprint) || !validIdentity(identity, fingerprint)) {
      throw new Error("store-corrupt");
    }
  }
  for (const [endpoint, fingerprint] of Object.entries(value.bindings)) {
    if (
      typeof fingerprint !== "string" ||
      !FINGERPRINT.test(fingerprint) ||
      !hasOwn(value.identities, fingerprint) ||
      !isCanonicalEndpoint(endpoint)
    ) {
      throw new Error("store-corrupt");
    }
  }
  if (
    value.cleanup.some(
      (fingerprint) =>
        typeof fingerprint !== "string" ||
        !FINGERPRINT.test(fingerprint) ||
        Object.values(value.bindings as Record<string, string>).includes(fingerprint),
    )
  ) {
    throw new Error("store-corrupt");
  }
  return value as unknown as MtlsConfiguration;
}

function isCanonicalEndpoint(endpoint: string): boolean {
  try {
    return normalizeEndpoint(`https://${endpoint}`) === endpoint;
  } catch {
    return false;
  }
}

export class MtlsRegistry {
  private activeConfiguration: MtlsConfiguration;
  private nextConfiguration: MtlsConfiguration;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly directory: string;
  private readonly filename: string;

  private constructor(userData: string, configuration: MtlsConfiguration) {
    this.directory = path.join(userData, "mtls");
    this.filename = path.join(this.directory, "registry.json");
    this.activeConfiguration = clone(configuration);
    this.nextConfiguration = clone(configuration);
  }

  static async load(userData: string): Promise<MtlsRegistry> {
    const filename = path.join(userData, "mtls", "registry.json");
    let configuration: MtlsConfiguration;
    try {
      configuration = validateConfiguration(JSON.parse(await fs.readFile(filename, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("store-corrupt");
      }
      configuration = {
        version: 1,
        revision: 0,
        storeId: randomUUID(),
        identities: {},
        bindings: {},
        cleanup: [],
      };
    }
    return new MtlsRegistry(userData, configuration);
  }

  get active(): MtlsConfiguration {
    return clone(this.activeConfiguration);
  }

  get pending(): MtlsConfiguration {
    return clone(this.nextConfiguration);
  }

  get restartRequired(): boolean {
    return this.nextConfiguration.revision !== this.activeConfiguration.revision;
  }

  addIdentity(identity: IdentityMetadata, expectedRevision: number): Promise<MtlsConfiguration> {
    if (!FINGERPRINT.test(identity.fingerprint) || !validIdentity(identity, identity.fingerprint)) {
      return Promise.reject(new Error("invalid-file"));
    }
    return this.mutate(expectedRevision, (next) => {
      next.identities[identity.fingerprint] = clone(identity);
      next.cleanup = next.cleanup.filter((fingerprint) => fingerprint !== identity.fingerprint);
    });
  }

  scheduleCleanup(fingerprint: Fingerprint, expectedRevision: number): Promise<MtlsConfiguration> {
    if (!FINGERPRINT.test(fingerprint)) {
      return Promise.reject(new Error("invalid-file"));
    }
    return this.mutate(expectedRevision, (next) => {
      if (Object.values(next.bindings).includes(fingerprint)) {
        throw new Error("conflict");
      }
      if (!next.cleanup.includes(fingerprint)) {
        next.cleanup.push(fingerprint);
      }
    });
  }

  commitIdentity(
    identity: IdentityMetadata,
    endpointUrls: readonly string[],
    expectedRevision: number,
    replaceExisting: boolean,
  ): Promise<MtlsConfiguration> {
    if (!FINGERPRINT.test(identity.fingerprint) || !validIdentity(identity, identity.fingerprint)) {
      return Promise.reject(new Error("invalid-file"));
    }
    if (endpointUrls.length < 1 || endpointUrls.length > 32) {
      return Promise.reject(new Error("invalid-endpoint"));
    }
    const endpoints = endpointUrls.map(normalizeEndpoint);
    return this.mutate(expectedRevision, (next) => {
      for (const endpoint of endpoints) {
        if (
          hasOwn(next.bindings, endpoint) &&
          next.bindings[endpoint] !== identity.fingerprint &&
          !replaceExisting
        ) {
          throw new Error("conflict");
        }
      }
      next.identities[identity.fingerprint] = clone(identity);
      next.cleanup = next.cleanup.filter((fingerprint) => fingerprint !== identity.fingerprint);
      for (const endpoint of endpoints) {
        next.bindings[endpoint] = identity.fingerprint;
      }
    });
  }

  bind(
    fingerprint: Fingerprint,
    endpointUrls: readonly string[],
    expectedRevision: number,
    replaceExisting: boolean,
  ): Promise<MtlsConfiguration> {
    if (endpointUrls.length < 1 || endpointUrls.length > 32) {
      return Promise.reject(new Error("invalid-endpoint"));
    }
    const endpoints = endpointUrls.map(normalizeEndpoint);
    return this.mutate(expectedRevision, (next) => {
      if (!hasOwn(next.identities, fingerprint)) {
        throw new Error("identity-missing");
      }
      for (const endpoint of endpoints) {
        if (
          hasOwn(next.bindings, endpoint) &&
          next.bindings[endpoint] !== fingerprint &&
          !replaceExisting
        ) {
          throw new Error("conflict");
        }
        next.bindings[endpoint] = fingerprint;
      }
    });
  }

  unbind(endpointUrl: string, expectedRevision: number): Promise<MtlsConfiguration> {
    const endpoint = normalizeEndpoint(endpointUrl);
    return this.mutate(expectedRevision, (next) => {
      delete next.bindings[endpoint];
    });
  }

  remove(fingerprint: Fingerprint, expectedRevision: number): Promise<MtlsConfiguration> {
    if (!FINGERPRINT.test(fingerprint)) {
      return Promise.reject(new Error("identity-missing"));
    }
    return this.mutate(expectedRevision, (next) => {
      if (!hasOwn(next.identities, fingerprint)) {
        throw new Error("identity-missing");
      }
      for (const [endpoint, bound] of Object.entries(next.bindings)) {
        if (bound === fingerprint) {
          delete next.bindings[endpoint];
        }
      }
      delete next.identities[fingerprint];
      if (!next.cleanup.includes(fingerprint)) {
        next.cleanup.push(fingerprint);
      }
    });
  }

  completeCleanup(fingerprint: Fingerprint, expectedRevision: number): Promise<MtlsConfiguration> {
    if (!FINGERPRINT.test(fingerprint)) {
      return Promise.reject(new Error("identity-missing"));
    }
    return this.mutate(expectedRevision, (next) => {
      if (Object.values(next.bindings).includes(fingerprint)) {
        throw new Error("conflict");
      }
      next.cleanup = next.cleanup.filter((pending) => pending !== fingerprint);
    });
  }

  private mutate(
    expectedRevision: number,
    change: (configuration: MtlsConfiguration) => void,
  ): Promise<MtlsConfiguration> {
    const operation = this.queue.then(async () => {
      if (expectedRevision !== this.nextConfiguration.revision) {
        throw new Error("conflict");
      }
      const next = clone(this.nextConfiguration);
      change(next);
      next.revision++;
      validateConfiguration(next);
      await this.persist(next);
      this.nextConfiguration = next;
      return clone(next);
    });
    this.queue = operation.catch((): void => undefined);
    return operation;
  }

  private async persist(configuration: MtlsConfiguration): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(this.directory, `.registry-${randomUUID()}.json`);
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(configuration));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, this.filename);
      const directory = await fs.open(this.directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      });
    }
  }
}
