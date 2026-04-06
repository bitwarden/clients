// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { filter, mergeMap } from "rxjs";

import {
  AbstractStorageService,
  ObservableStorageService,
  StorageUpdateType,
} from "@bitwarden/common/platform/abstractions/storage.service";

import { fromChromeEvent } from "../../browser/from-chrome-event";

export const serializationIndicator = "__json__";

export type SerializedValue = { [serializationIndicator]: true; value: string };

/**
 * Serializes the given object and decorates it to indicate it is serialized.
 *
 * We have the problem that it is difficult to tell when a value has been serialized, by always
 * storing objects decorated with this method, we can easily tell when a value has been serialized and
 * deserialize it appropriately.
 * @param obj object to decorate and serialize
 * @returns a serialized version of the object, decorated to indicate that it is serialized
 */
export const objToStore = (obj: any) => {
  if (obj == null) {
    return null;
  }

  if (obj instanceof Set) {
    obj = Array.from(obj);
  }

  return {
    [serializationIndicator]: true as const,
    value: JSON.stringify(obj),
  };
};

export default abstract class AbstractChromeStorageService
  implements AbstractStorageService, ObservableStorageService
{
  updates$;

  constructor(protected chromeStorageApi: chrome.storage.StorageArea) {
    this.updates$ = fromChromeEvent(this.chromeStorageApi.onChanged).pipe(
      filter(([changes]) => {
        // Our storage services support changing only one key at a time. If more are changed, it's due to
        // reseeding storage and we should ignore the changes.
        return Object.keys(changes).length === 1;
      }),
      mergeMap(([changes]) => {
        return Object.entries(changes).map(([key, change]) => {
          // The `newValue` property isn't on the StorageChange object
          // when the change was from a remove. Similarly a check of the `oldValue`
          // could be used to tell if the operation was the first creation of this key
          // but we currently do not differentiate that.
          // Ref: https://developer.chrome.com/docs/extensions/reference/storage/#type-StorageChange
          // Ref: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageChange
          const updateType: StorageUpdateType = "newValue" in change ? "save" : "remove";

          return {
            key: key,
            // For removes this property will not exist but then it will just be
            // undefined which is fine.
            updateType: updateType,
          };
        });
      }),
    );
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  async get<T>(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.chromeStorageApi.get(key, (obj) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        if (obj != null && obj[key] != null) {
          resolve(this.processGetObject(obj[key]));
          return;
        }
        resolve(null);
      });
    });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) != null;
  }

  async save(key: string, obj: any): Promise<void> {
    obj = objToStore(obj);

    if (obj == null) {
      // Safari does not support set of null values
      return this.remove(key);
    }

    const keyedObj = { [key]: obj };
    return new Promise<void>((resolve, reject) => {
      this.chromeStorageApi.set(keyedObj, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        resolve();
      });
    });
  }

  async remove(key: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.chromeStorageApi.remove(key, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        resolve();
      });
    });
  }

  /** Backwards compatible resolution of retrieved object with new serialized storage */
  protected processGetObject<T>(obj: T | SerializedValue): T | null {
    if (this.isSerialized(obj)) {
      obj = JSON.parse(obj.value);
    }
    return obj as T;
  }

  /** Type guard for whether an object is tagged as serialized */
  protected isSerialized<T>(value: T | SerializedValue): value is SerializedValue {
    const asSerialized = value as SerializedValue;
    return (
      asSerialized != null &&
      asSerialized[serializationIndicator] &&
      typeof asSerialized.value === "string"
    );
  }
}
