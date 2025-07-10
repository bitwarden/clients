import { Subject } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";

export class ElectronRendererStorageService implements AbstractStorageService {
  private updatesSubject = new Subject<StorageUpdate>();

  get valuesRequireDeserialization(): boolean {
    return true;
  }
  updates$;

  constructor() {
    this.updates$ = this.updatesSubject.asObservable();
  }

  get<T>(key: string): Promise<T> {
    return ipc.platform.storage.get(key);
  }

  has(key: string): Promise<boolean> {
    return ipc.platform.storage.has(key);
  }

  async save<T>(key: string, obj: T): Promise<void> {
    await ipc.platform.storage.save(key, obj);
    this.updatesSubject.next({ key, updateType: "save" });
  }

  async remove(key: string): Promise<void> {
    await ipc.platform.storage.remove(key);
    this.updatesSubject.next({ key, updateType: "remove" });
  }
}
