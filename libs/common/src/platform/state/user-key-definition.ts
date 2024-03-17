import { UserId } from "../../types/guid";
import { StorageKey } from "../../types/state";
import { Utils } from "../misc/utils";

import { array, record } from "./deserialization-helpers";
import { KeyDefinition, KeyDefinitionOptions } from "./key-definition";
import { StateDefinition } from "./state-definition";

export type ClearEvent = "lock" | "logout";

type UserKeyDefinitionOptions<T> = KeyDefinitionOptions<T> & {
  clearOn: ClearEvent[];
};

const USER_KEY_DEFINITION_MARKER: unique symbol = Symbol("UserKeyDefinition");

export function isUserKeyDefinition<T>(
  keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
): keyDefinition is UserKeyDefinition<T> {
  return (
    USER_KEY_DEFINITION_MARKER in keyDefinition &&
    keyDefinition[USER_KEY_DEFINITION_MARKER] === true
  );
}

export class UserKeyDefinition<T> {
  readonly [USER_KEY_DEFINITION_MARKER] = true;
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
   *
   * @param keyDefinition
   * @returns
   *
   * @deprecated You should not use this to convert, just create a {@link UserKeyDefinition}
   */
  static fromBaseKeyDefinition<T>(keyDefinition: KeyDefinition<T>) {
    return new UserKeyDefinition<T>(keyDefinition.stateDefinition, keyDefinition.key, {
      ...keyDefinition["options"],
      clearOn: [], // Default to not clearing
    });
  }

  /**
   * Creates a {@link UserKeyDefinition} for state that is an array.
   * @param stateDefinition The state definition to be added to the UserKeyDefinition
   * @param key The key to be added to the KeyDefinition
   * @param options The options to customize the final {@link UserKeyDefinition}.
   * @returns A {@link UserKeyDefinition} initialized for arrays, the options run
   * the deserializer on the provided options for each element of an array
   * **unless that array is null, in which case it will return an empty list.**
   *
   * @example
   * ```typescript
   * const MY_KEY = UserKeyDefinition.array<MyArrayElement>(MY_STATE, "key", {
   *   deserializer: (myJsonElement) => convertToElement(myJsonElement),
   * });
   * ```
   */
  static array<T>(
    stateDefinition: StateDefinition,
    key: string,
    // We have them provide options for the element of the array, depending on future options we add, this could get a little weird.
    options: UserKeyDefinitionOptions<T>,
  ) {
    return new UserKeyDefinition<T[]>(stateDefinition, key, {
      ...options,
      deserializer: array((e) => options.deserializer(e)),
    });
  }

  /**
   * Creates a {@link UserKeyDefinition} for state that is a record.
   * @param stateDefinition The state definition to be added to the UserKeyDefinition
   * @param key The key to be added to the KeyDefinition
   * @param options The options to customize the final {@link UserKeyDefinition}.
   * @returns A {@link UserKeyDefinition} that contains a serializer that will run the provided deserializer for each
   * value in a record and returns every key as a string **unless that record is null, in which case it will return an record.**
   *
   * @example
   * ```typescript
   * const MY_KEY = UserKeyDefinition.record<MyRecordValue>(MY_STATE, "key", {
   *   deserializer: (myJsonValue) => convertToValue(myJsonValue),
   * });
   * ```
   */
  static record<T, TKey extends string = string>(
    stateDefinition: StateDefinition,
    key: string,
    // We have them provide options for the value of the record, depending on future options we add, this could get a little weird.
    options: UserKeyDefinitionOptions<T>, // The array helper forces an initialValue of an empty record
  ) {
    return new UserKeyDefinition<Record<TKey, T>>(stateDefinition, key, {
      ...options,
      deserializer: record((v) => options.deserializer(v)),
    });
  }

  get fullName() {
    return `${this.stateDefinition.name}_${this.key}`;
  }

  buildKey(userId: UserId) {
    if (!Utils.isGuid(userId)) {
      throw new Error(
        `You cannot build a user key without a valid UserId, building for key ${this.fullName}`,
      );
    }
    return `user_${userId}_${this.stateDefinition.name}_${this.key}` as StorageKey;
  }

  private get errorKeyName() {
    return `${this.stateDefinition.name} > ${this.key}`;
  }
}
