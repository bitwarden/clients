import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingData } from "./phishing-data.service";

/**
 * Provides IndexedDB storage for phishing detection data.
 *
 */
export class PhishingIndexedDbService {
  private readonly DB_NAME = "bitwarden-phishing";
  private readonly STORE_NAME = "phishing-data";
  private readonly DATA_KEY = "phishing-domains";
  private readonly DB_VERSION = 1;

  constructor(private logService: LogService) {}

  /**
   * Saves phishing data to IndexedDB.
   * @returns true on success, false on error
   */
  async save(data: PhishingData): Promise<boolean> {
    try {
      const db = await this.openDatabase();
      await this.putData(db, data);
      db.close();
      return true;
    } catch (error) {
      this.logService.error("[PhishingIndexedDbService] Failed to save data", error);
      return false;
    }
  }

  /**
   * Loads phishing data from IndexedDB.
   * Returns null if no data exists or on error.
   */
  async load(): Promise<PhishingData | null> {
    try {
      const db = await this.openDatabase();
      const data = await this.getData(db);
      db.close();
      return data;
    } catch (error) {
      this.logService.error("[PhishingIndexedDbService] Failed to load data", error);
      return null;
    }
  }

  /**
   * Clears all phishing data from IndexedDB.
   * @returns true on success, false on error
   */
  async clear(): Promise<boolean> {
    try {
      const db = await this.openDatabase();
      await this.deleteData(db);
      db.close();
      return true;
    } catch (error) {
      this.logService.error("[PhishingIndexedDbService] Failed to clear data", error);
      return false;
    }
  }

  /** Opens the database, creating the object store if needed. */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  /** Stores data in the object store. */
  private putData(db: IDBDatabase, data: PhishingData): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(data, this.DATA_KEY);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /** Retrieves data from the object store. */
  private getData(db: IDBDatabase): Promise<PhishingData | null> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(this.DATA_KEY);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };
    });
  }

  /** Deletes data from the object store. */
  private deleteData(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(this.DATA_KEY);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}
