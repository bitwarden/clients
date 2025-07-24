// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Subject } from "rxjs";

import { StorageService, StorageUpdate } from "./storage.service";

export class MemoryStorageService extends StorageService {
  protected store = new Map<string, unknown>();
  private updatesSubject = new Subject<StorageUpdate>();

  get valuesRequireDeserialization(): boolean {
    return false;
  }
  get updates$() {
    return this.updatesSubject.asObservable();
  }

  get<T>(key: string): Promise<T> {
    if (this.store.has(key)) {
      const obj = this.store.get(key);
      return Promise.resolve(obj as T);
    }
    return Promise.resolve(null);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) != null;
  }

  save<T>(key: string, obj: T): Promise<void> {
    if (obj == null) {
      return this.remove(key);
    }
    // TODO: Remove once foreground/background contexts are separated in browser
    // Needed to ensure ownership of all memory by the context running the storage service
    const toStore = structuredClone(obj);
    this.store.set(key, toStore);
    this.updatesSubject.next({ key, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.delete(key);
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }
}
