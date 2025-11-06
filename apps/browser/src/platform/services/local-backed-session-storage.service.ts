// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Subject } from "rxjs";

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
import { Lazy } from "@bitwarden/common/platform/misc/lazy";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { BrowserApi } from "../browser/browser-api";
import { MemoryStoragePortMessage } from "../storage/port-messages";
import { portName } from "../storage/port-name";

export class LocalBackedSessionStorageService
  extends AbstractStorageService
  implements ObservableStorageService
{
  private ports: Set<chrome.runtime.Port> = new Set([]);
  private cache: Record<string, unknown> = {};
  private updatesSubject = new Subject<StorageUpdate>();
  readonly valuesRequireDeserialization = true;
  updates$ = this.updatesSubject.asObservable();

  constructor(
    private readonly sessionKey: Lazy<Promise<SymmetricCryptoKey>>,
    private readonly localStorage: AbstractStorageService,
    private readonly encryptService: EncryptService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly logService: LogService,
  ) {
    super();

    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      if (port.name !== portName(chrome.storage.session)) {
        return;
      }
      if (!BrowserApi.senderIsInternal(port.sender)) {
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
    if (this.cache[key] !== undefined) {
      return this.cache[key] as T;
    }

    const value = await this.getLocalSessionValue(await this.sessionKey.get(), key);

    if (this.cache[key] === undefined && value !== undefined) {
      // Cache is still empty and we just got a value from local/session storage, cache it.
      this.cache[key] = value;
      return value as T;
    } else if (this.cache[key] === undefined && value === undefined) {
      // Cache is still empty and we got nothing from local/session storage, no need to modify cache.
      return value as T;
    } else if (this.cache[key] !== undefined && value !== undefined) {
      // Conflict, somebody wrote to the cache while we were reading from storage
      // but we also got a value from storage. We assume the cache is more up to date
      // and use that value.
      this.logService.warning(
        `Conflict while reading from local session storage, both cache and storage have values. Key: ${key}. Using cached value.`,
      );
      return this.cache[key] as T;
    } else if (this.cache[key] !== undefined && value === undefined) {
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
    const encValue = await this.encryptService.encryptString(
      valueJson,
      await this.sessionKey.get(),
    );
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

  protected broadcastMessage(data: Omit<MemoryStoragePortMessage, "originator">) {
    this.ports.forEach((port) => {
      this.sendMessageTo(port, data);
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
    return `session_${key}`;
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
