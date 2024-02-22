import { UserId } from "../../types/guid";
import { StorageKey } from "../../types/state";
import { Utils } from "../misc/utils";

import { array, record } from "./deserialization-helpers";
import { ClearEvent, KeyDefinition, KeyDefinitionOptions } from "./key-definition";
import { StateDefinition } from "./state-definition";

type UserKeyDefinitionOptions<T> = KeyDefinitionOptions<T> & {
  clearOn: ClearEvent[];
};

export class UserKeyDefinition<T> {
  /**
   * A unique array of events that the state stored at this key should be cleared on.
   */
  readonly clearOn: ClearEvent[];

  constructor(
    readonly stateDefinition: StateDefinition,
    readonly key: string,
    private readonly options: UserKeyDefinitionOptions<T>,
  ) {
    if (options.deserializer == null) {
      throw new Error(`'deserializer' is a required property on key ${this.errorKeyName}`);
    }

    if (options.cleanupDelayMs <= 0) {
      throw new Error(
        `'cleanupDelayMs' must be greater than 0. Value of ${options.cleanupDelayMs} passed to key ${this.errorKeyName} `,
      );
    }

    // Filter out repeat values
    this.clearOn = Array.from(new Set(options.clearOn));
  }

  /**
   *
   * @param keyDefinition
   * @returns
   *
   * @deprecated You should not use this to convert, just create a {@link UserKeyDefinition}
   */
  static fromBaseKeyDefinition<T>(keyDefinition: KeyDefinition<T>) {
    return new UserKeyDefinition(keyDefinition.stateDefinition, keyDefinition.key, {
      ...keyDefinition["options"],
      clearOn: [], // Default to not clearing
    });
  }

  /**
   * Gets the deserializer configured for this {@link KeyDefinition}
   */
  get deserializer() {
    return this.options.deserializer;
  }

  /**
   * Gets the number of milliseconds to wait before cleaning up the state after the last subscriber has unsubscribed.
   */
  get cleanupDelayMs() {
    return this.options.cleanupDelayMs < 0 ? 0 : this.options.cleanupDelayMs ?? 1000;
  }

  /**
   * Creates a {@link KeyDefinition} for state that is an array.
   * @param stateDefinition The state definition to be added to the KeyDefinition
   * @param key The key to be added to the KeyDefinition
   * @param options The options to customize the final {@link KeyDefinition}.
   * @returns A {@link KeyDefinition} initialized for arrays, the options run
   * the deserializer on the provided options for each element of an array
   * **unless that array is null, in which case it will return an empty list.**
   *
   * @example
   * ```typescript
   * const MY_KEY = KeyDefinition.array<MyArrayElement>(MY_STATE, "key", {
   *   deserializer: (myJsonElement) => convertToElement(myJsonElement),
   * });
   * ```
   */
  static array<T>(
    stateDefinition: StateDefinition,
    key: string,
    // We have them provide options for the element of the array, depending on future options we add, this could get a little weird.
    options: KeyDefinitionOptions<T>, // The array helper forces  an initialValue of an empty array
  ) {
    return new KeyDefinition<T[]>(stateDefinition, key, {
      ...options,
      deserializer: array(options.deserializer),
    });
  }

  /**
   * Creates a {@link KeyDefinition} for state that is a record.
   * @param stateDefinition The state definition to be added to the KeyDefinition
   * @param key The key to be added to the KeyDefinition
   * @param options The options to customize the final {@link KeyDefinition}.
   * @returns A {@link KeyDefinition} that contains a serializer that will run the provided deserializer for each
   * value in a record and returns every key as a string **unless that record is null, in which case it will return an record.**
   *
   * @example
   * ```typescript
   * const MY_KEY = KeyDefinition.record<MyRecordValue>(MY_STATE, "key", {
   *   deserializer: (myJsonValue) => convertToValue(myJsonValue),
   * });
   * ```
   */
  static record<T, TKey extends string = string>(
    stateDefinition: StateDefinition,
    key: string,
    // We have them provide options for the value of the record, depending on future options we add, this could get a little weird.
    options: KeyDefinitionOptions<T>, // The array helper forces an initialValue of an empty record
  ) {
    return new KeyDefinition<Record<TKey, T>>(stateDefinition, key, {
      ...options,
      deserializer: record(options.deserializer),
    });
  }

  get fullName() {
    return `${this.stateDefinition.name}_${this.key}`;
  }

  buildKey(userId: UserId) {
    if (!Utils.isGuid(userId)) {
      throw new Error("You cannot build a user key without a valid UserId");
    }
    return `user_${userId}_${this.stateDefinition.name}_${this.key}` as StorageKey;
  }

  private get errorKeyName() {
    return `${this.stateDefinition.name} > ${this.key}`;
  }
}
