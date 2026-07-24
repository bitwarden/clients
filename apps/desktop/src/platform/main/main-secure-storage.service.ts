import { throwError } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { passwords } from "@bitwarden/desktop-napi";

/**
 * Main-process secure storage backed directly by the OS credential store (napi `passwords`).
 *
 * The renderer reaches the OS keychain over IPC via `DesktopCredentialStorageListener`
 * ({@link ../main/desktop-credential-storage-listener.ts}); this is the equivalent for code running
 * in the main process, calling the same napi API in-process. The `serviceName`/`keySuffix` scheme
 * matches that listener so both processes address the same keychain entries.
 *
 * Intended as the secure-storage backing for a main-process SDK service stack (TokenService /
 * KeyService / StateService). Not wired yet — see the Stage 3 gate in the plan.
 */
export class MainSecureStorageService implements AbstractStorageService {
  constructor(
    private logService: LogService,
    private serviceName = "Bitwarden",
  ) {}

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get updates$() {
    return throwError(
      () => new Error("Secure storage implementations cannot have their updates subscribed to."),
    );
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    try {
      const val = await passwords.getPassword(this.serviceNameFor(options), key);
      return val != null ? (JSON.parse(val) as T) : null;
    } catch (e) {
      if (this.isNotFound(e)) {
        return null;
      }
      throw e;
    }
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    try {
      const val = await passwords.getPassword(this.serviceNameFor(options), key);
      return val != null;
    } catch (e) {
      if (this.isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    await passwords.setPassword(this.serviceNameFor(options), key, JSON.stringify(obj));
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    try {
      await passwords.deletePassword(this.serviceNameFor(options), key);
    } catch (e) {
      if (this.isNotFound(e)) {
        return;
      }
      this.logService.error("[MainSecureStorageService] Failed to remove secure value", e);
      throw e;
    }
  }

  /**
   * Build the keychain service name for an entry. Mirrors `DesktopCredentialStorageListener`:
   * the base service name, suffixed with `_<keySuffix>` when a key suffix is provided.
   */
  private serviceNameFor(options?: StorageOptions): string {
    const keySuffix = options?.keySuffix;
    return keySuffix != null && keySuffix !== ""
      ? `${this.serviceName}_${keySuffix}`
      : this.serviceName;
  }

  private isNotFound(e: unknown): boolean {
    return e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND;
  }
}
