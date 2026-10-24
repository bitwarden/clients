import { throwError } from "rxjs";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { passwords } from "@bitwarden/desktop-napi";

/**
 * The secure storage implementation for the Electron main process, backed by the OS keychain
 * (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux) via the
 * `@bitwarden/desktop-napi` `passwords` module.
 */
export class MainSecureStorageService implements AbstractStorageService {
  constructor(private readonly serviceName: string) {}

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get updates$() {
    return throwError(
      () => new Error("Secure storage implementations cannot have their updates subscribed to."),
    );
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    const serviceName = this.resolveServiceName(options?.keySuffix ?? "");
    try {
      const val = await passwords.getPassword(serviceName, key);
      return val != null ? (JSON.parse(val) as T) : null;
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        return null;
      }
      throw e;
    }
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    return (await this.get(key, options)) != null;
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    const serviceName = this.resolveServiceName(options?.keySuffix ?? "");
    await passwords.setPassword(serviceName, key, JSON.stringify(obj));
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    const serviceName = this.resolveServiceName(options?.keySuffix ?? "");
    try {
      await passwords.deletePassword(serviceName, key);
    } catch (e) {
      // Deleting a key that is not present is a no-op, not an error.
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        return;
      }
      throw e;
    }
  }

  private resolveServiceName(keySuffix: string): string {
    return keySuffix ? `${this.serviceName}_${keySuffix}` : this.serviceName;
  }
}
