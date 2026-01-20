import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * IndexedDB storage service for phishing URLs.
 * Stores URLs as individual rows
 */
export class PhishingIndexedDbService {
  private readonly DB_NAME = "bitwarden-phishing";
  private readonly STORE_NAME = "phishing-urls";
  private readonly DB_VERSION = 1;
  private readonly CHUNK_SIZE = 50000;

  constructor(private logService: LogService) {}

  /**
   * Opens the IndexedDB database, creating the object store if needed.
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: "url" });
        }
      };
    });
  }

  /**
   * Clears all records from the phishing URLs store.
   */
  private clearStore(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = db.transaction(this.STORE_NAME, "readwrite").objectStore(this.STORE_NAME).clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
}
