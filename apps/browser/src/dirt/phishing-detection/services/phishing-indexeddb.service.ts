import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Record type for phishing URL storage in IndexedDB.
 */
type PhishingUrlRecord = { url: string };

/**
 * IndexedDB storage service for phishing URLs.
 * Stores URLs as individual rows.
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

  /**
   * Saves an array of phishing URLs to IndexedDB.
   * Atomically replaces all existing data.
   *
   * @param urls - Array of phishing URLs to save
   * @returns `true` if save succeeded, `false` on error
   */
  async saveUrls(urls: string[]): Promise<boolean> {
    let db: IDBDatabase | null = null;
    try {
      db = await this.openDatabase();
      await this.clearStore(db);
      await this.saveChunked(db, urls);
      return true;
    } catch (error) {
      this.logService.error("[PhishingIndexedDbService] Save failed", error);
      return false;
    } finally {
      db?.close();
    }
  }

  /**
   * Saves URLs in chunks to prevent transaction timeouts and UI freezes.
   */
  private async saveChunked(db: IDBDatabase, urls: string[]): Promise<void> {
    for (let i = 0; i < urls.length; i += this.CHUNK_SIZE) {
      await this.saveChunk(db, urls.slice(i, i + this.CHUNK_SIZE));
      await new Promise((r) => setTimeout(r, 0)); // Yield to event loop
    }
  }

  /**
   * Saves a single chunk of URLs in one transaction.
   */
  private saveChunk(db: IDBDatabase, urls: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.STORE_NAME);
      for (const url of urls) {
        if (url.trim()) {
          store.put({ url: url.trim() } as PhishingUrlRecord);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Checks if a URL exists in the phishing database.
   *
   * @param url - The URL to check
   * @returns `true` if URL exists, `false` if not found or on error
   */
  async hasUrl(url: string): Promise<boolean> {
    let db: IDBDatabase | null = null;
    try {
      db = await this.openDatabase();
      return await this.checkUrlExists(db, url);
    } catch (error) {
      this.logService.error("[PhishingIndexedDbService] Check failed", error);
      return false;
    } finally {
      db?.close();
    }
  }

  /**
   * Performs the actual URL existence check using index lookup.
   */
  private checkUrlExists(db: IDBDatabase, url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readonly");
      const req = tx.objectStore(this.STORE_NAME).get(url);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result !== undefined);
    });
  }
}
