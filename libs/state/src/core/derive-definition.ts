// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { UserId } from "@bitwarden/user-core";

import { DerivedStateDependencies, StorageKey } from "../types/state";

import { KeyDefinition } from "./key-definition";
import { StateDefinition } from "./state-definition";
import { UserKeyDefinition } from "./user-key-definition";

declare const depShapeMarker: unique symbol;
/**
 * A set of options for customizing the behavior of a {@link DeriveDefinition}
 */
type DeriveDefinitionOptions<TFrom, TTo, TDeps extends DerivedStateDependencies = never> = {
  /**
   * A function to use to convert values from TFrom to TTo. This is called on each emit of the parent state observable
   * and the resulting value will be emitted from the derived state observable.
   *
   * @param from Populated with the latest emission from the parent state observable.
   * @param deps Populated with the dependencies passed into the constructor of the derived state.
   * These are constant for the lifetime of the derived state.
   * @returns  The derived state value or a Promise that resolves to the derived state value.
   */
  derive: (from: TFrom, deps: TDeps) => TTo | Promise<TTo>;
  /**
   * A function to use to safely convert your type from json to your expected type.
   *
   * **Important:** Your data may be serialized/deserialized at any time and this
   *  callback needs to be able to faithfully re-initialize from the JSON object representation of your type.
   *
   * @param jsonValue The JSON object representation of your state.
   * @returns The fully typed version of your state.
   */
  deserializer: (serialized: Jsonify<TTo>) => TTo;
  /**
   * An object defining the dependencies of the derive function. The keys of the object are the names of the dependencies
   * and the values are the types of the dependencies.
   *
   * for example:
   * ```
   * {
   *   myService: MyService,
   *   myOtherService: MyOtherService,
   * }
   * ```
   */
  [depShapeMarker]?: TDeps;
  /**
   * The number of milliseconds to wait before cleaning up the state after the last subscriber has unsubscribed.
   * Defaults to 1000ms.
   */
  cleanupDelayMs?: number;
  /**
   * Whether or not to clear the derived state when cleanup occurs. Defaults to true.
   */
  clearOnCleanup?: boolean;
};

/**
 * DeriveDefinitions describe state derived from another observable, the value type of which is given by `TFrom`.
 *
 * The StateDefinition is used to describe the domain of the state, and the DeriveDefinition
 * sub-divides that domain into specific keys. These keys are used to cache data in memory and enables derived state to
 * be calculated once regardless of multiple execution contexts.
 */

export class DeriveDefinition<TFrom, TTo, TDeps extends DerivedStateDependencies> {
  /**
   * Creates a new instance of a DeriveDefinition. Derived state is always stored in memory, so the storage location
   * defined in @link{StateDefinition} is ignored.
   *
   * @param stateDefinition The state definition for which this key belongs to.
   * @param uniqueDerivationName The name of the key, this should be unique per domain.
   * @param options A set of options to customize the behavior of {@link DeriveDefinition}.
   * @param options.derive A function to use to convert values from TFrom to TTo. This is called on each emit of the parent state observable
   * and the resulting value will be emitted from the derived state observable.
   * @param options.cleanupDelayMs The number of milliseconds to wait before cleaning up the state after the last subscriber has unsubscribed.
   * Defaults to 1000ms.
   * @param options.dependencyShape An object defining the dependencies of the derive function. The keys of the object are the names of the dependencies
   * and the values are the types of the dependencies.
   * for example:
   * ```
   * {
   *   myService: MyService,
   *   myOtherService: MyOtherService,
   * }
   * ```
   *
   * @param options.deserializer A function to use to safely convert your type from json to your expected type.
   *   Your data may be serialized/deserialized at any time and this needs callback needs to be able to faithfully re-initialize
   *   from the JSON object representation of your type.
   */
  constructor(
    readonly stateDefinition: StateDefinition,
    readonly uniqueDerivationName: string,
    readonly options: DeriveDefinitionOptions<TFrom, TTo, TDeps>,
  ) {}

  /**
   * Factory that produces a {@link DeriveDefinition} from a {@link KeyDefinition} or {@link DeriveDefinition} and new name.
   *
   * If a `KeyDefinition` is passed in, the returned definition will have the same key as the given key definition, but
   * will not collide with it in storage, even if they both reside in memory.
   *
   * If a `DeriveDefinition` is passed in, the returned definition will instead use the name given in the second position
   * of the tuple. It is up to you to ensure this is unique within the domain of derived state.
   *
   * @param options A set of options to customize the behavior of {@link DeriveDefinition}.
   * @param options.derive A function to use to convert values from TFrom to TTo. This is called on each emit of the parent state observable
   * and the resulting value will be emitted from the derived state observable.
   * @param options.cleanupDelayMs The number of milliseconds to wait before cleaning up the state after the last subscriber has unsubscribed.
   * Defaults to 1000ms.
   * @param options.dependencyShape An object defining the dependencies of the derive function. The keys of the object are the names of the dependencies
   * and the values are the types of the dependencies.
   * for example:
   * ```
   * {
   *   myService: MyService,
   *   myOtherService: MyOtherService,
   * }
   * ```
   *
   * @param options.deserializer A function to use to safely convert your type from json to your expected type.
   *   Your data may be serialized/deserialized at any time and this needs callback needs to be able to faithfully re-initialize
   *   from the JSON object representation of your type.
   * @param definition
   * @param options
   * @returns
   */
  static from<TFrom, TTo, TDeps extends DerivedStateDependencies = never>(
    definition:
      | KeyDefinition<TFrom>
      | UserKeyDefinition<TFrom>
      | [DeriveDefinition<unknown, TFrom, DerivedStateDependencies>, string],
    options: DeriveDefinitionOptions<TFrom, TTo, TDeps>,
  ) {
    if (isFromDeriveDefinition(definition)) {
      return new DeriveDefinition(definition[0].stateDefinition, definition[1], options);
    } else {
      return new DeriveDefinition(definition.stateDefinition, definition.key, options);
    }
  }

  static fromWithUserId<TKeyDef, TTo, TDeps extends DerivedStateDependencies = never>(
    definition:
      | KeyDefinition<TKeyDef>
      | UserKeyDefinition<TKeyDef>
      | [DeriveDefinition<unknown, TKeyDef, DerivedStateDependencies>, string],
    options: DeriveDefinitionOptions<[UserId, TKeyDef], TTo, TDeps>,
  ) {
    if (isFromDeriveDefinition(definition)) {
      return new DeriveDefinition(definition[0].stateDefinition, definition[1], options);
    } else {
      return new DeriveDefinition(definition.stateDefinition, definition.key, options);
    }
  }

  get derive() {
    return this.options.derive;
  }

  deserialize(serialized: Jsonify<TTo>): TTo {
    return this.options.deserializer(serialized);
  }

  get cleanupDelayMs() {
    return this.options.cleanupDelayMs < 0 ? 0 : (this.options.cleanupDelayMs ?? 1000);
  }

  get clearOnCleanup() {
    return this.options.clearOnCleanup ?? true;
  }

  buildCacheKey(): string {
    return `derived_${this.stateDefinition.name}_${this.uniqueDerivationName}`;
  }

  /**
   * Creates a {@link StorageKey} that points to the data for the given derived definition.
   * @returns A key that is ready to be used in a storage service to get data.
   */
  get storageKey(): StorageKey {
    return `derived_${this.stateDefinition.name}_${this.uniqueDerivationName}` as StorageKey;
  }
}

function isFromDeriveDefinition(
  definition:
    | KeyDefinition<unknown>
    | UserKeyDefinition<unknown>
    | [DeriveDefinition<unknown, unknown, DerivedStateDependencies>, string],
): definition is [DeriveDefinition<unknown, unknown, DerivedStateDependencies>, string] {
  return Array.isArray(definition);
}
