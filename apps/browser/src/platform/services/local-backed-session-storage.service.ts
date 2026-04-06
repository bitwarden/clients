// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Subject } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AbstractStorageService,
  ObservableStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { compareValues } from "@bitwarden/common/platform/misc/compare-values";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { StorageService } from "@bitwarden/storage-core";

import { BrowserApi } from "../browser/browser-api";
import { MemoryStoragePortMessage } from "../storage/port-messages";
import { portName } from "../storage/port-name";

import BrowserLocalStorageService from "./browser-local-storage.service";

const SESSION_KEY_PREFIX = "session_";

/**
 * Manages an ephemeral session key for encrypting session storage items persisted in local storage.
 *
 * The session key is stored in session storage and automatically cleared when the browser session ends
 * (e.g., browser restart, extension reload). When the session key is unavailable, any encrypted items
 * in local storage cannot be decrypted and must be cleared to maintain data consistency.
 *
 * This provides session-scoped security for sensitive data while using persistent local storage as the backing store.
 *
 * @internal Internal implementation detail. Exported only for testing purposes.
 * Do not use this class directly outside of tests. Use LocalBackedSessionStorageService instead.
 */
export class SessionKeyResolveService {
  constructor(
    private readonly storageService: StorageService,
    private readonly keyGenerationService: KeyGenerationService,
  ) {}

  /**
   * Retrieves the session key from storage.
   *
   * @return session key or null when not in storage
   */
  async get(): Promise<SymmetricCryptoKey | null> {
    const key = await this.storageService.get<SymmetricCryptoKey>("session-key");
    if (key) {
      if (this.storageService.valuesRequireDeserialization) {
        return SymmetricCryptoKey.fromJSON(key);
      }
      return key;
    }
    return null;
  }

  /**
   * Creates new session key and adds it to underlying storage.
   *
   * @return newly created session key
   */
  async create(): Promise<SymmetricCryptoKey> {
    const { derivedKey } = await this.keyGenerationService.createKeyWithPurpose(
      128,
      "ephemeral",
      "bitwarden-ephemeral",
    );
    await this.storageService.save("session-key", derivedKey.toJSON());
    return derivedKey;
  }
}

export class LocalBackedSessionStorageService
  extends AbstractStorageService
  implements ObservableStorageService
{
  readonly valuesRequireDeserialization = true;
  private ports: Set<chrome.runtime.Port> = new Set([]);
  private cache: Record<string, unknown> = {};
  private updatesSubject = new Subject<StorageUpdate>();
  updates$ = this.updatesSubject.asObservable();
  private readonly sessionKeyResolveService: SessionKeyResolveService;

  constructor(
    private readonly memoryStorage: StorageService,
    private readonly localStorage: BrowserLocalStorageService,
    private readonly keyGenerationService: KeyGenerationService,
    private readonly encryptService: EncryptService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly logService: LogService,
  ) {
    super();

    this.sessionKeyResolveService = new SessionKeyResolveService(
      this.memoryStorage,
      this.keyGenerationService,
    );

    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      if (port.name !== portName(chrome.storage.session)) {
        return;
      }
      if (!BrowserApi.senderIsInternal(port.sender, this.logService)) {
        return;
      }

      this.ports.add(port);

      const listenerCallback = this.onMessageFromForeground.bind(this);
      port.onDisconnect.addListener(() => {
        this.ports.delete(port);
        port.onMessage.removeListener(listenerCallback);
      });
      port.onMessage.addListener(listenerCallback);
      // Initialize the new memory storage service with existing data
      this.sendMessageTo(port, {
        action: "initialization",
        data: Array.from(Object.keys(this.cache)),
      });
      this.updates$.subscribe((update) => {
        this.broadcastMessage({
          action: "subject_update",
          data: update,
        });
      });
    });
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    if (this.cache[key] != null) {
      return this.cache[key] as T;
    }

    const value = await this.getLocalSessionValue(await this.getSessionKey(), key);

    if (this.cache[key] == null && value != null) {
      // Cache is still empty and we just got a value from local/session storage, cache it.
      this.cache[key] = value;
      return value as T;
    } else if (this.cache[key] == null && value == null) {
      // Cache is still empty and we got nothing from local/session storage, no need to modify cache.
      return value as T;
    } else if (this.cache[key] != null && value != null) {
      // Conflict, somebody wrote to the cache while we were reading from storage
      // but we also got a value from storage. We assume the cache is more up to date
      // and use that value.
      this.logService.warning(
        `Conflict while reading from local session storage, both cache and storage have values. Key: ${key}. Using cached value.`,
      );
      return this.cache[key] as T;
    } else if (this.cache[key] != null && value == null) {
      // Cache was filled after the local/session storage read completed. We got null
      // from the storage read, but we have a value from the cache, use that.
      this.logService.warning(
        `Conflict while reading from local session storage, cache has value but storage does not. Key: ${key}. Using cached value.`,
      );
      return this.cache[key] as T;
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) != null;
  }

  async save<T>(key: string, obj: T): Promise<void> {
    // This is for observation purposes only. At some point, we don't want to write to local session storage if the value is the same.
    if (this.platformUtilsService.isDev()) {
      const existingValue = this.cache[key] as T;
      try {
        if (this.compareValues<T>(existingValue, obj)) {
          this.logService.warning(
            `Possible unnecessary write to local session storage. Key: ${key}`,
          );
        }
      } catch (err) {
        this.logService.warning(`Error while comparing values for key: ${key}`);
        this.logService.warning(err);
      }
    }

    if (obj == null) {
      return await this.remove(key);
    }

    this.cache[key] = obj;
    await this.updateLocalSessionValue(key, obj);
    this.updatesSubject.next({ key, updateType: "save" });
  }

  async remove(key: string): Promise<void> {
    this.cache[key] = null;
    await this.updateLocalSessionValue(key, null);
    this.updatesSubject.next({ key, updateType: "remove" });
  }

  protected broadcastMessage(data: Omit<MemoryStoragePortMessage, "originator">) {
    this.ports.forEach((port) => {
      this.sendMessageTo(port, data);
    });
  }

  private async getSessionKey(): Promise<SymmetricCryptoKey> {
    const sessionKey = await this.sessionKeyResolveService.get();
    if (sessionKey != null) {
      return sessionKey;
    }

    // Session key is missing (browser restart/extension reload), so all stored session data
    // cannot be decrypted. Clear all items before creating a new session key.
    await this.clear();

    return await this.sessionKeyResolveService.create();
  }

  /**
   * Removes all stored session data.
   *
   * Called when the session key is unavailable (typically after browser restart or extension reload),
   * making all encrypted session data unrecoverable. Prevents orphaned encrypted data from accumulating.
   */
  private async clear() {
    const keys = (await this.localStorage.getKeys()).filter((key) =>
      key.startsWith(SESSION_KEY_PREFIX),
    );
    this.logService.debug(
      `[LocalBackedSessionStorageService] Clearing local session storage. Found ${keys}`,
    );
    for (const key of keys) {
      const keyWithoutPrefix = key.substring(SESSION_KEY_PREFIX.length);
      await this.remove(keyWithoutPrefix);
    }
  }

  private async getLocalSessionValue(encKey: SymmetricCryptoKey, key: string): Promise<unknown> {
    const local = await this.localStorage.get<string>(this.sessionStorageKey(key));
    if (local == null) {
      return null;
    }

    try {
      const valueJson = await this.encryptService.decryptString(new EncString(local), encKey);
      return JSON.parse(valueJson);
    } catch {
      // error with decryption, value is lost, delete state and start over
      await this.localStorage.remove(this.sessionStorageKey(key));
      return null;
    }
  }

  private async updateLocalSessionValue(key: string, value: unknown): Promise<void> {
    if (value == null) {
      await this.localStorage.remove(this.sessionStorageKey(key));
      return;
    }

    const valueJson = JSON.stringify(value);
    const encValue = await this.encryptService.encryptString(valueJson, await this.getSessionKey());
    await this.localStorage.save(this.sessionStorageKey(key), encValue.encryptedString);
  }

  private async onMessageFromForeground(
    message: MemoryStoragePortMessage,
    port: chrome.runtime.Port,
  ) {
    if (message.originator === "background") {
      return;
    }

    let result: unknown = null;

    switch (message.action) {
      case "get":
      case "has": {
        result = await this[message.action](message.key);
        break;
      }
      case "save":
        await this.save(message.key, JSON.parse((message.data as string) ?? null) as unknown);
        break;
      case "remove":
        await this.remove(message.key);
        break;
    }

    this.sendMessageTo(port, {
      id: message.id,
      key: message.key,
      data: JSON.stringify(result),
    });
  }

  private sendMessageTo(
    port: chrome.runtime.Port,
    data: Omit<MemoryStoragePortMessage, "originator">,
  ) {
    port.postMessage({
      ...data,
      originator: "background",
    });
  }

  private sessionStorageKey(key: string) {
    return `${SESSION_KEY_PREFIX}${key}`;
  }

  private compareValues<T>(value1: T, value2: T): boolean {
    try {
      return compareValues(value1, value2);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.logService.error(
        `error comparing values\n${JSON.stringify(value1)}\n${JSON.stringify(value2)}`,
      );
      return true;
    }
  }
}
