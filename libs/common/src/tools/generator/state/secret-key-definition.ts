import { KeyDefinitionOptions } from "../../../platform/state";
// eslint-disable-next-line -- `StateDefinition` used as an argument
import { StateDefinition } from "../../../platform/state/state-definition";
import { SecretClassifier } from "./secret-classifier";

/** Encryption and storage settings for data stored by a `SecretState`.
 */
export class SecretKeyDefinition<Outer, Id, Inner extends object, Disclosed, Secret> {
  private constructor(
    readonly stateDefinition: StateDefinition,
    readonly key: string,
    readonly classifier: SecretClassifier<Inner, Disclosed, Secret>,
    readonly options: KeyDefinitionOptions<Inner>,
    // type erasure is necessary here because typescript doesn't support
    // higher kinded types that generalize over collections. The invariants
    // needed to make this typesafe are maintained by the static factories.
    readonly deconstruct: (value: any) => [Id, any][],
    readonly reconstruct: ([inners, ids]: (readonly [Id, any])[]) => Outer,
  ) {}

  /**
   * Define a secret state for a single value
   * @param stateDefinition The domain of the secret's durable state.
   * @param key Domain key that identifies the stored value. This key must not be reused
   *    in any capacity.
   * @param classifier Partitions the value into encrypted, discarded, and public data.
   * @param options Configures the operation of the secret state.
   */
  static value<Value extends object, Disclosed, Secret>(
    stateDefinition: StateDefinition,
    key: string,
    classifier: SecretClassifier<Value, Disclosed, Secret>,
    options: KeyDefinitionOptions<Value>,
  ) {
    return new SecretKeyDefinition<Value, void, Value, Disclosed, Secret>(
      stateDefinition,
      key,
      classifier,
      options,
      (value) => [[null, value]],
      ([[, inner]]) => inner,
    );
  }

  /**
   * Define a secret state for an array of values. Each item is encrypted separately.
   * @param stateDefinition The domain of the secret's durable state.
   * @param key Domain key that identifies the stored items. This key must not be reused
   *    in any capacity.
   * @param classifier Partitions each item into encrypted, discarded, and public data.
   * @param options Configures the operation of the secret state.
   */
  static array<Item extends object, Disclosed, Secret>(
    stateDefinition: StateDefinition,
    key: string,
    classifier: SecretClassifier<Item, Disclosed, Secret>,
    options: KeyDefinitionOptions<Item>,
  ) {
    return new SecretKeyDefinition<Item[], number, Item, Disclosed, Secret>(
      stateDefinition,
      key,
      classifier,
      options,
      (value) => value.map((v: any, id: number) => [id, v]),
      (values) => values.map(([, v]) => v),
    );
  }

  /**
   * Define a secret state for a record. Each property is encrypted separately.
   * @param stateDefinition The domain of the secret's durable state.
   * @param key Domain key that identifies the stored properties. This key must not be reused
   *    in any capacity.
   * @param classifier Partitions each property into encrypted, discarded, and public data.
   * @param options Configures the operation of the secret state.
   */
  static record<Item extends object, Disclosed, Secret, Id extends string | number>(
    stateDefinition: StateDefinition,
    key: string,
    classifier: SecretClassifier<Item, Disclosed, Secret>,
    options: KeyDefinitionOptions<Item>,
  ) {
    return new SecretKeyDefinition<Record<Id, Item>, Id, Item, Disclosed, Secret>(
      stateDefinition,
      key,
      classifier,
      options,
      (value) => Object.entries(value) as [Id, Item][],
      (values) => Object.fromEntries(values) as Record<Id, Item>,
    );
  }
}
