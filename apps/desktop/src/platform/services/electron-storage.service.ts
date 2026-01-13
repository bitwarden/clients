// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";

import { ipcMain } from "electron";
import ElectronStore from "electron-store";
import { Subject } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { LogService } from "@bitwarden/logging";
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
  private updatesSubject = new Subject<StorageUpdate>();
  updates$;

  constructor(
    private logService: LogService,
    dir: string,
    defaults = {},
  ) {
    if (!fs.existsSync(dir)) {
      NodeUtils.mkdirpSync(dir, "700");
    }
    const fileMode = isWindowsPortable() ? 0o666 : 0o600;
    const storeConfig: ElectronStore.Options<Record<string, unknown>> = {
      defaults: defaults,
      name: "data",
      configFileMode: fileMode,
    };

    try {
      this.store = new ElectronStore(storeConfig);
    } catch (error) {
      // If initialization fails due to corrupted JSON, backup and recreate
      this.logService.error("ElectronStore initialization failed, attempting recovery", error);

      const dataFilePath = `${dir}/data.json`;
      if (fs.existsSync(dataFilePath)) {
        try {
          // Backup the corrupted file
          const backupPath = `${dir}/data.json.corrupt.${Date.now()}`;
          fs.renameSync(dataFilePath, backupPath);
          this.logService.warning(`Backed up corrupted data file to ${backupPath}`);
        } catch (backupError) {
          this.logService.error("Failed to backup corrupted file", backupError);
          // If backup fails, try to delete the corrupted file
          try {
            fs.unlinkSync(dataFilePath);
            this.logService.warning("Deleted corrupted data file");
          } catch (deleteError) {
            this.logService.error("Failed to delete corrupted file", deleteError);
          }
        }
      }

      // Try to create the store again with a clean slate
      try {
        this.store = new ElectronStore(storeConfig);
        this.logService.info("ElectronStore recovered successfully");
      } catch (retryError) {
        this.logService.error("Failed to recover ElectronStore", retryError);
        throw retryError;
      }
    }

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
    try {
      const val = this.store.get(key) as T;
      return Promise.resolve(val != null ? val : null);
    } catch (error) {
      // If we fail to get a value due to deserialization error, log and return null
      this.logService.error("Error retrieving value from ElectronStore", key, error);
      // Attempt to remove the corrupted key
      try {
        this.store.delete(key);
      } catch (cleanupError) {
        // Ignore errors during cleanup
        this.logService.debug("Failed to clean up corrupted key", key, cleanupError);
      }
      return Promise.resolve(null);
    }
  }

  has(key: string): Promise<boolean> {
    try {
      const val = this.store.get(key);
      return Promise.resolve(val != null);
    } catch (error) {
      // If we fail to check due to deserialization error, treat as not existing
      this.logService.error("Error checking for key existence in ElectronStore", key, error);
      return Promise.resolve(false);
    }
  }

  save(key: string, obj: unknown): Promise<void> {
    if (obj === undefined) {
      return this.remove(key);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj);
    }

    try {
      this.store.set(key, obj);
      this.updatesSubject.next({ key, updateType: "save" });
      return Promise.resolve();
    } catch (error) {
      this.logService.error("Error saving value to ElectronStore", key, error);
      return Promise.reject(error);
    }
  }

  remove(key: string): Promise<void> {
    try {
      this.store.delete(key);
      this.updatesSubject.next({ key, updateType: "remove" });
      return Promise.resolve();
    } catch (error) {
      this.logService.error("Error removing from ElectronStore", key, error);
      return Promise.reject(error);
    }
  }
}
