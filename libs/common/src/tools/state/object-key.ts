import { UserKeyDefinition, UserKeyDefinitionOptions } from "../../platform/state";
// eslint-disable-next-line -- `StateDefinition` used as a type
import type { StateDefinition } from "../../platform/state/state-definition";

import { ClassifiedFormat } from "./classified-format";
import { Classifier } from "./classifier";

/** Determines the format of persistent storage.
 *  `plain` storage is a plain-old javascript object. Use this type
 *    when you are performing your own encryption and decryption.
 *  `classified` uses the `ClassifiedFormat` type as its format.
 *  `secret-state` uses `Array<ClassifiedFormat>` with a length of 1.
 */
export type ObjectStorageFormat = "plain" | "classified" | "secret-state";

/** A key for storing JavaScript objects (`{ an: "example" }`)
 * in a UserStateSubject.
 */
// FIXME: promote to class: `ObjectConfiguration<State, Secret, Disclosed>`.
//        The class receives `encryptor`, `prepareNext`, `adjust`, and `fix`
//        From `UserStateSubject`. `UserStateSubject` keeps `classify` and
//        `declassify`. The class should also include serialization
//        facilities (to be used in place of JSON.parse/stringify) in it's
//        options. Also allow swap between "classifier" and "classification"; the
//        latter is a list of properties/arguments to the specific classifier in-use.
export type ObjectKey<State, Secret = State, Disclosed = Record<string, never>> = {
  /** Type of data stored by this key; Object keys always use "object" targets.
   *  "object" - a singleton value.
   *  "list" - multiple values identified by their list index.
   *  "record" - multiple values identified by a uuid.
   */
  target: "object";

  /** Identifies the stored state */
  key: string;

  /** Defines the storage location and parameters for this state */
  state: StateDefinition;

  /** Defines the visibility and encryption treatment for the stored state.
   *  Disclosed data is written as plain-text. Secret data is protected with
   *  the user key.
   */
  classifier: Classifier<State, Disclosed, Secret>;

  /** Specifies the format of data written to storage.
   *  @remarks - CAUTION! If your on-disk data is not in a correct format,
   *   the storage system treats the data as corrupt and returns your initial
   *   value.
   */
  format: ObjectStorageFormat;

  /** customizes the behavior of the storage location */
  options: UserKeyDefinitionOptions<State>;

  /** When this is defined, empty data is replaced with a copy of the initial data.
   *  This causes the state to always be defined from the perspective of the
   *  subject's consumer.
   */
  initial?: State;

  /** For encrypted outputs, determines how much padding is applied to
   *  encoded inputs. When this isn't specified, each frame is 32 bytes
   *  long.
   */
  frame?: number;
};

/** Performs a type inference that identifies object keys. */
export function isObjectKey(key: any): key is ObjectKey<unknown> {
  return key.target === "object" && "format" in key && "classifier" in key;
}

/** Converts an object key to a plaform-compatible `UserKeyDefinition`. */
export function toUserKeyDefinition<State, Secret, Disclosed>(
  key: ObjectKey<State, Secret, Disclosed>,
) {
  if (key.format === "plain") {
    const plain = new UserKeyDefinition<State>(key.state, key.key, key.options);

    return plain;
  } else if (key.format === "classified") {
    const classified = new UserKeyDefinition<ClassifiedFormat<void, Disclosed>>(
      key.state,
      key.key,
      {
        cleanupDelayMs: key.options.cleanupDelayMs,
        deserializer: (jsonValue) => jsonValue as ClassifiedFormat<void, Disclosed>,
        clearOn: key.options.clearOn,
      },
    );

    return classified;
  } else if (key.format === "secret-state") {
    const classified = new UserKeyDefinition<[ClassifiedFormat<void, Disclosed>]>(
      key.state,
      key.key,
      {
        cleanupDelayMs: key.options.cleanupDelayMs,
        deserializer: (jsonValue) => jsonValue as [ClassifiedFormat<void, Disclosed>],
        clearOn: key.options.clearOn,
      },
    );

    return classified;
  } else {
    throw new Error(`unknown format: ${key.format}`);
  }
}
