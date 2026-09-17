// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { throwError } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

const SECURE_STORAGE_TRACK_GROUP = "Platform";
const SECURE_STORAGE_TRACK = "Secure storage";

export class ElectronRendererSecureStorageService implements AbstractStorageService {
  constructor(private readonly logService: LogService) {}

  get valuesRequireDeserialization(): boolean {
    return true;
  }
  get updates$() {
    return throwError(
      () => new Error("Secure storage implementations cannot have their updates subscribed to."),
    );
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    // Only the operation is recorded; keys identify users and must stay out of logs.
    const start = performance.now();
    const val = await ipc.platform.passwords.get(key, options?.keySuffix ?? "");
    this.logService.measure(start, SECURE_STORAGE_TRACK_GROUP, SECURE_STORAGE_TRACK, "get");

    return val != null ? (JSON.parse(val) as T) : null;
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    const val = await ipc.platform.passwords.has(key, options?.keySuffix ?? "");
    return !!val;
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    const start = performance.now();
    await ipc.platform.passwords.set(key, options?.keySuffix ?? "", JSON.stringify(obj));
    this.logService.measure(start, SECURE_STORAGE_TRACK_GROUP, SECURE_STORAGE_TRACK, "set");
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    await ipc.platform.passwords.delete(key, options?.keySuffix ?? "");
  }
}
