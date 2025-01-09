import { MockProxy, mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import {
  AbstractStorageService,
  ObservableStorageService,
  StorageUpdate,
} from "../src/platform/abstractions/storage.service";
import { StorageOptions } from "../src/platform/models/domain/storage-options";

const INTERNAL_KEY = "__internal__";

export class FakeStorageService implements AbstractStorageService, ObservableStorageService {
  private store: Record<string, unknown>;
  private updatesSubject = new Subject<StorageUpdate>();
  private _valuesRequireDeserialization = false;

  /**
   * Returns a mock of a {@see AbstractStorageService} for asserting the expected
   * amount of calls. It is not recommended to use this to mock implementations as
   * they are not respected.
   */
  mock: MockProxy<AbstractStorageService>;

  constructor(initial?: Record<string, unknown>) {
    this.store = initial ?? {};
    this.mock = mock<AbstractStorageService>();
  }

  /**
   * Updates the internal store for this fake implementation, this bypasses any mock calls
   * or updates to the {@link updates$} observable.
   * @param store
   */
  internalUpdateStore(store: Record<string, unknown>) {
    this.store = store;
  }

  get internalStore() {
    return this.store;
  }

  internalUpdateValuesRequireDeserialization(value: boolean) {
    this._valuesRequireDeserialization = value;
  }

  get valuesRequireDeserialization(): boolean {
    return this._valuesRequireDeserialization;
  }

  get updates$() {
    return this.updatesSubject.asObservable();
  }

  get<T>(key: string, options?: StorageOptions): Promise<T> {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.mock.get(key, options);
    const value = this.store[key] as T;
    return Promise.resolve(value);
  }
  has(key: string, options?: StorageOptions): Promise<boolean> {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.mock.has(key, options);
    return Promise.resolve(this.store[key] != null);
  }
  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    // These exceptions are copied from https://github.com/sindresorhus/conf/blob/608adb0c46fb1680ddbd9833043478367a64c120/source/index.ts#L193-L203
    // which is a library that is used by `ElectronStorageService`. We add them here to ensure that the behavior in our testing mirrors the real world.
    if (typeof key !== "string" && typeof key !== "object") {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`,
      );
    }

    // We don't throw this error because ElectronStorageService automatically detects this case
    // and calls `delete()` instead of `set()`.
    // if (typeof key !== "object" && obj === undefined) {
    //   throw new TypeError("Use `delete()` to clear values");
    // }

    if (this._containsReservedKey(key)) {
      throw new TypeError(
        `Please don't use the ${INTERNAL_KEY} key, as it's used to manage this module internal operations.`,
      );
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.mock.save(key, obj, options);
    this.store[key] = obj;
    this.updatesSubject.next({ key: key, updateType: "save" });
  }
  remove(key: string, options?: StorageOptions): Promise<void> {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.mock.remove(key, options);
    delete this.store[key];
    this.updatesSubject.next({ key: key, updateType: "remove" });
    return Promise.resolve();
  }

  private _containsReservedKey(key: string | Partial<unknown>): boolean {
    if (typeof key === "object") {
      const firsKey = Object.keys(key)[0];

      if (firsKey === INTERNAL_KEY) {
        return true;
      }
    }

    if (typeof key !== "string") {
      return false;
    }

    return false;
  }
}
