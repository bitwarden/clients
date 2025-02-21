// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, Subject } from "rxjs";

import {
  AbstractStorageService,
  ObservableStorageService,
  StorageUpdate,
} from "../abstractions/storage.service";
import { StorageOptions } from "../models/domain/storage-options";

export class WindowStorageService implements AbstractStorageService, ObservableStorageService {
  private readonly updatesSubject = new Subject<StorageUpdate>();

  updates$: Observable<StorageUpdate>;
  constructor(private readonly storage: Storage) {
    this.updates$ = this.updatesSubject.asObservable();
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get<T>(key: string, options?: StorageOptions): Promise<T> {
    const jsonValue = this.storage.getItem(key);
    if (jsonValue != null) {
      return Promise.resolve(JSON.parse(jsonValue) as T);
    }

    return Promise.resolve(null);
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    return (await this.get(key, options)) != null;
  }

  save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    if (obj == null) {
      return this.remove(key, options);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj) as T;
    }

    this.storage.setItem(key, JSON.stringify(obj));
    this.updatesSubject.next({ key, updateType: "save" });
  }

  remove(key: string, options?: StorageOptions): Promise<void> {
    this.storage.removeItem(key);
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }

  getKeys(): string[] {
    return Object.keys(this.storage);
  }
}
