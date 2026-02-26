import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type JsonState = Record<string, unknown>;

export class JsonStateStore {
  private readonly dataFilePath: string;
  private readonly cache: JsonState;
  private flushTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(
    directoryPath: string,
    defaults: JsonState = {},
    private readonly writeCooldownMs = 1000,
  ) {
    this.dataFilePath = join(directoryPath, "data.json");
    this.cache = this.initializeState(directoryPath, defaults);
  }

  get<T>(key: string): T {
    return this.cache[key] as T;
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, key);
  }

  set(key: string, value: unknown): void {
    this.cache[key] = value;
    this.markDirty();
  }

  remove(key: string): void {
    delete this.cache[key];
    this.markDirty();
  }

  flush(): void {
    this.clearScheduledFlush();
    this.persistIfDirty();
  }

  dispose(): void {
    this.flush();
  }

  private initializeState(directoryPath: string, defaults: JsonState): JsonState {
    this.ensureDirectory(directoryPath);

    if (!existsSync(this.dataFilePath)) {
      const initialState = { ...defaults };
      this.writeStateSync(initialState);
      return initialState;
    }

    return this.readExistingState();
  }

  private ensureDirectory(directoryPath: string): void {
    if (existsSync(directoryPath)) {
      return;
    }

    mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  }

  private readExistingState(): JsonState {
    try {
      const fileContents = readFileSync(this.dataFilePath, "utf8").trim();
      if (fileContents.length === 0) {
        return {};
      }

      const parsed = JSON.parse(fileContents) as unknown;
      if (this.isJsonState(parsed)) {
        return parsed;
      }

      return {};
    } catch {
      this.backupCorruptState();
      return {};
    }
  }

  private isJsonState(value: unknown): value is JsonState {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  private backupCorruptState(): void {
    if (!existsSync(this.dataFilePath)) {
      return;
    }

    try {
      copyFileSync(this.dataFilePath, `${this.dataFilePath}.bak`);
    } catch {
      return;
    }
  }

  private markDirty(): void {
    this.dirty = true;
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer != null) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.persistIfDirty();
    }, this.writeCooldownMs);
  }

  private clearScheduledFlush(): void {
    if (this.flushTimer == null) {
      return;
    }

    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private persistIfDirty(): void {
    if (!this.dirty) {
      return;
    }

    this.writeStateSync(this.cache);
    this.dirty = false;
  }

  private writeStateSync(state: JsonState): void {
    writeFileSync(this.dataFilePath, JSON.stringify(state), { mode: 0o600 });
    chmodSync(this.dataFilePath, 0o600);
  }
}
