// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import AbstractChromeStorageService, {
  SerializedValue,
} from "./abstractions/abstract-chrome-storage-api.service";

export default class BrowserLocalStorageService extends AbstractChromeStorageService {
  constructor(private readonly logService: LogService) {
    super(chrome.storage.local);
  }

  override async get<T>(key: string): Promise<T> {
    return await this.getWithRetries<T>(key, 0);
  }

  private async getWithRetries<T>(key: string, retryNum: number): Promise<T> {
    // See: https://github.com/EFForg/privacybadger/pull/2980
    const MAX_RETRIES = 5;
    const WAIT_TIME = 200;

    const store = await this.getStore(key);

    if (store == null) {
      if (retryNum >= MAX_RETRIES) {
        throw new Error(`Failed to get a value for key '${key}', see logs for more details.`);
      }

      retryNum++;
      this.logService.warning(`Retrying attempt to get value for key '${key}' in ${WAIT_TIME}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, WAIT_TIME));
      return await this.getWithRetries(key, retryNum);
    }

    // We have a store
    return this.processGetObject<T>(store[key] as T | SerializedValue);
  }

  private async getStore(key: string) {
    if (this.chromeStorageApi == null) {
      this.logService.warning(
        `chrome.storage.local was not initialized while retrieving key '${key}'.`,
      );
      return null;
    }

    return new Promise<{ [key: string]: unknown }>((resolve) => {
      this.chromeStorageApi.get(key, (store) => {
        if (chrome.runtime.lastError) {
          this.logService.warning(`Failed to get value for key '${key}'`, chrome.runtime.lastError);
          resolve(null);
          return;
        }

        if (store == null) {
          this.logService.warning(`Store was empty while retrieving value for key '${key}'`);
          resolve(null);
          return;
        }

        resolve(store);
      });
    });
  }

  async fillBuffer() {
    // Write 4MB of data in chrome.storage.local, log files will hold 4MB of data (by default)
    // before forcing a compaction. To force a compaction and have it remove previously saved data,
    // we want to fill it's buffer so that anything newly marked for deletion is gone.
    // https://github.com/google/leveldb/blob/main/doc/impl.md#log-files
    // It's important that if Google uses a different buffer length that we match that, as far as I can tell
    // Google uses the default value in Chromium:
    // https://github.com/chromium/chromium/blob/148774efa6b3a047369af6179a4248566b39d68f/components/value_store/lazy_leveldb.cc#L65-L66
    const fakeData = "0".repeat(1024 * 1024); // 1MB of data
    await new Promise<void>((resolve, reject) => {
      this.chromeStorageApi.set(
        {
          fake_data_1: fakeData,
          fake_data_2: fakeData,
          fake_data_3: fakeData,
          fake_data_4: fakeData,
        },
        () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }

          resolve();
        },
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.chromeStorageApi.remove(
        ["fake_data_1", "fake_data_2", "fake_data_3", "fake_data_4"],
        () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }

          resolve();
        },
      );
    });
  }
}
