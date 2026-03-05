import { ipcMain } from "electron";
import { Observable, Subject } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";

import { JsonStateStore } from "./json-state-store";

type StorageIpcRequest =
  | { action: "get"; key: string }
  | { action: "has"; key: string }
  | { action: "save"; key: string; obj: unknown }
  | { action: "remove"; key: string };

export class ElectronStorageService implements AbstractStorageService {
  private readonly updatesSubject = new Subject<StorageUpdate>();
  private readonly stateStore: JsonStateStore;
  readonly updates$: Observable<StorageUpdate>;

  constructor(directoryPath: string, defaults: Record<string, unknown> = {}) {
    this.stateStore = new JsonStateStore(directoryPath, defaults);

    this.updates$ = this.updatesSubject.asObservable();
    ipcMain.handle("storageService", (_event, options: StorageIpcRequest) => {
      switch (options.action) {
        case "get":
          return this.get(options.key);
        case "has":
          return this.has(options.key);
        case "save":
          return this.save(options.key, options.obj);
        case "remove":
          return this.remove(options.key);
        default:
          return Promise.reject(new Error("Unsupported storage action."));
      }
    });
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get<T>(key: string): Promise<T> {
    return Promise.resolve(this.stateStore.get<T>(key));
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this.stateStore.has(key));
  }

  save<T>(key: string, obj: T): Promise<void> {
    if (obj === undefined) {
      return this.remove(key);
    }

    let valueToStore: unknown = obj;
    if (obj instanceof Set) {
      valueToStore = Array.from(obj);
    }

    this.stateStore.set(key, valueToStore);
    this.updatesSubject.next({ key, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.stateStore.remove(key);
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }

  flush(): void {
    this.stateStore.flush();
  }

  dispose(): void {
    this.stateStore.dispose();
  }
}
