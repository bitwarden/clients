import { Subject } from "rxjs";

import {
  AbstractStorageService,
  ObservableStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";

export class BrowserIndexedDbStorageService
  implements AbstractStorageService, ObservableStorageService
{
  private updatesSubject = new Subject<StorageUpdate>();
  readonly updates$ = this.updatesSubject.asObservable();
  private dbPromise: Promise<IDBDatabase>;
  private readonly DB_NAME = "BitwardenLargeStorage";
  private readonly STORE_NAME = "keyvaluepairs";

  constructor() {
    this.dbPromise = this.openDb();
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  get valuesRequireDeserialization(): boolean {
    return false; // IndexedDB handles objects natively
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => {
          const result = (request.result as T) ?? null;
          resolve(result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch {
      return null;
    }
  }

  async save(key: string, value: any): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => {
        this.updatesSubject.next({ key, updateType: "save" });
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => {
        this.updatesSubject.next({ key, updateType: "remove" });
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val != null;
  }
}
