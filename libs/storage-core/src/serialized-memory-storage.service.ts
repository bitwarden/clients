// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Subject } from "rxjs";

import { StorageService, ObservableStorageService, StorageUpdate } from "./storage.service";

export class SerializedMemoryStorageService
  extends StorageService
  implements ObservableStorageService
{
  protected store: Record<string, string> = {};
  private updatesSubject = new Subject<StorageUpdate>();

  get valuesRequireDeserialization(): boolean {
    return true;
  }
  get updates$() {
    return this.updatesSubject.asObservable();
  }

  get<T>(key: string): Promise<T> {
    const json = this.store[key];
    if (json) {
      const obj = JSON.parse(json as string);
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
    this.store[key] = JSON.stringify(obj);
    this.updatesSubject.next({ key, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    delete this.store[key];
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }
}
