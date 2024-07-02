import { defer, filter, firstValueFrom, map, merge, throwError, timeout } from "rxjs";

import AbstractChromeStorageService, {
  SerializedValue,
  objToStore,
} from "./abstractions/abstract-chrome-storage-api.service";

export const RESEED_IN_PROGRESS_KEY = "reseedInProgress";

export default class BrowserLocalStorageService extends AbstractChromeStorageService {
  constructor() {
    super(chrome.storage.local);
    this.chromeStorageApi.remove(RESEED_IN_PROGRESS_KEY, () => {
      return;
    });
  }

  /**
   * Reads, clears, and re-saves all data in local storage. This is a hack to remove previously stored sensitive data from
   * local storage logs.
   *
   * @see https://github.com/bitwarden/clients/issues/485
   */
  async reseed(): Promise<void> {
    try {
      await this.save(RESEED_IN_PROGRESS_KEY, true);
      const data = await this.getAll();
      await this.clear();
      await this.saveAll(data);
    } finally {
      await super.remove(RESEED_IN_PROGRESS_KEY);
    }
  }

  override async get<T>(key: string): Promise<T> {
    await this.awaitReseed();
    return super.get(key);
  }

  override async has(key: string): Promise<boolean> {
    await this.awaitReseed();
    return super.has(key);
  }

  override async save(key: string, obj: any): Promise<void> {
    await this.awaitReseed();
    return super.save(key, obj);
  }

  override async remove(key: string): Promise<void> {
    await this.awaitReseed();
    return super.remove(key);
  }

  private async awaitReseed(): Promise<void> {
    const notReseeding = async () => {
      return !(await super.get(RESEED_IN_PROGRESS_KEY));
    };

    const finishedReseeding = this.updates$.pipe(
      filter(({ key, updateType }) => key === RESEED_IN_PROGRESS_KEY && updateType === "remove"),
      map(() => true),
    );

    await firstValueFrom(
      merge(defer(notReseeding), finishedReseeding).pipe(
        filter((v) => v),
        timeout({
          // We eventually need to give up and throw an error
          first: 5_000,
          with: () =>
            throwError(
              () => new Error("Reseeding local storage did not complete in a timely manner."),
            ),
        }),
      ),
    );
  }

  /**
   * Clears local storage
   */
  private async clear() {
    return new Promise<void>((resolve) => {
      this.chromeStorageApi.clear(() => {
        resolve();
      });
    });
  }

  /**
   * Retrieves all objects stored in local storage.
   *
   * @remarks This method processes values prior to resolving, do not use `chrome.storage.local` directly
   * @returns Promise resolving to keyed object of all stored data
   */
  private async getAll(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      this.chromeStorageApi.get(null, (allStorage) => {
        const resolved = Object.entries(allStorage).reduce(
          (agg, [key, value]) => {
            agg[key] = this.processGetObject(value);
            return agg;
          },
          {} as Record<string, unknown>,
        );
        resolve(resolved);
      });
    });
  }

  private async saveAll(data: Record<string, unknown>): Promise<void> {
    return new Promise<void>((resolve) => {
      const keyedData = Object.entries(data).reduce(
        (agg, [key, value]) => {
          agg[key] = objToStore(value);
          return agg;
        },
        {} as Record<string, SerializedValue>,
      );
      this.chromeStorageApi.set(keyedData, () => {
        resolve();
      });
    });
  }
}
