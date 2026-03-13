// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";

import { ipcMain } from "electron";
import ElectronStore, { Options as ElectronStoreOptions } from "electron-store";
import { Subject } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { isWindowsPortable } from "../../utils";

interface BaseOptions<T extends string> {
  action: T;
  key: string;
}

interface SaveOptions extends BaseOptions<"save"> {
  obj: unknown;
}

type Options = BaseOptions<"get"> | BaseOptions<"has"> | SaveOptions | BaseOptions<"remove">;

export class ElectronStorageService implements AbstractStorageService {
  private store: ElectronStore;
  private readonly flushDelayMs = 1000;
  private cache: Record<string, unknown>;
  private isDirty = false;
  private flushTimeout: NodeJS.Timeout | null = null;
  private updatesSubject = new Subject<StorageUpdate>();
  updates$;

  constructor(dir: string, defaults = {}) {
    if (!fs.existsSync(dir)) {
      NodeUtils.mkdirpSync(dir, "700");
    }
    const fileMode = isWindowsPortable() ? 0o666 : 0o600;
    const storeConfig: ElectronStoreOptions<Record<string, unknown>> = {
      defaults: defaults,
      name: "data",
      configFileMode: fileMode,
    };
    this.store = new ElectronStore(storeConfig);
    this.cache = { ...this.store.store };
    this.updates$ = this.updatesSubject.asObservable();

    ipcMain.handle("storageService", (event, options: Options) => {
      switch (options.action) {
        case "get":
          return this.get(options.key);
        case "has":
          return this.has(options.key);
        case "save":
          return this.save(options.key, options.obj);
        case "remove":
          return this.remove(options.key);
      }
    });
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get<T>(key: string): Promise<T> {
    const val = this.cache[key] as T;
    return Promise.resolve(val != null ? val : null);
  }

  has(key: string): Promise<boolean> {
    const val = this.cache[key];
    return Promise.resolve(val != null);
  }

  save(key: string, obj: unknown): Promise<void> {
    if (obj === undefined) {
      return this.remove(key);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj);
    }

    this.cache[key] = obj;
    this.markDirty();
    this.updatesSubject.next({ key, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    delete this.cache[key];
    this.markDirty();
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }

  list(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.cache));
  }

  dispose(): void {
    this.clearScheduledFlush();
    this.flushToDisk();
  }

  private markDirty() {
    if (this.isDirty) {
      return;
    }

    this.isDirty = true;
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimeout != null) {
      return;
    }

    this.flushTimeout = setTimeout(() => {
      this.clearScheduledFlush();
      this.flushToDisk();
    }, this.flushDelayMs);
  }

  private clearScheduledFlush() {
    if (this.flushTimeout == null) {
      return;
    }

    clearTimeout(this.flushTimeout);
    this.flushTimeout = null;
  }

  private flushToDisk() {
    if (!this.isDirty) {
      return;
    }

    this.store.store = { ...this.cache };
    this.isDirty = false;
  }
}
