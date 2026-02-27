import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

export class IllegalSecureStorageService implements AbstractStorageService {
  constructor() {}

  get valuesRequireDeserialization(): boolean {
    throw new Error("Method not implemented.");
  }
  has(key: string, options?: StorageOptions): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async get<T>(key: string): Promise<T> {
    throw new Error("Method not implemented.");
  }
  async set<T>(key: string, obj: T): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async remove(key: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
