import { Observable } from "rxjs";

import { StorageOptions } from "./storage-options";

export type StorageUpdateType = "save" | "remove";
export type StorageUpdate = {
  key: string;
  updateType: StorageUpdateType;
};

export interface ObservableStorageService {
  /**
   * Provides an {@link Observable} that represents a stream of updates that
   * have happened in this storage service or in the storage this service provides
   * an interface to.
   */
  get updates$(): Observable<StorageUpdate>;
}

export abstract class StorageService {
  abstract get valuesRequireDeserialization(): boolean;
  abstract get<T>(key: string, options?: StorageOptions): Promise<T>;
  abstract has(key: string, options?: StorageOptions): Promise<boolean>;
  abstract save<T>(key: string, obj: T, options?: StorageOptions): Promise<void>;
  abstract remove(key: string, options?: StorageOptions): Promise<void>;
}
