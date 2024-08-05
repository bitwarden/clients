import { Jsonify } from "type-fest";

import { Classifier } from "./classifier";

/** Classifies an object's JSON-serializable data by property into
 *  3 categories:
 *  * Disclosed data MAY be stored in plaintext.
 *  * Excluded data MUST NOT be saved.
 *  * The remaining data is secret and MUST be stored using encryption.
 *
 *  This type should not be used to classify functions.
 *  Data that cannot be serialized by JSON.stringify() should
 *  be excluded.
 */
export class SecretClassifier<Plaintext extends object, Disclosed, Secret>
  implements Classifier<Plaintext, Disclosed, Secret>
{
  private constructor(
    disclosed: readonly (keyof Jsonify<Disclosed> & keyof Jsonify<Plaintext>)[],
    excluded: readonly (keyof Plaintext)[],
  ) {
    this.disclosed = disclosed;
    this.excluded = excluded;
  }

  /** lists the disclosed properties. */
  readonly disclosed: readonly (keyof Jsonify<Disclosed> & keyof Jsonify<Plaintext>)[];

  /** lists the excluded properties. */
  readonly excluded: readonly (keyof Plaintext)[];

  /** Creates a classifier where all properties are secret.
   *  @type {T} The type of secret being classified.
   */
  static allSecret<T extends object>() {
    const disclosed = Object.freeze([]);
    const excluded = Object.freeze([]);
    return new SecretClassifier<T, Record<keyof T, never>, T>(disclosed, excluded);
  }

  /** Classify a property as disclosed.
   *  @type {PropertyName} Available secrets to disclose.
   *  @param disclose The property name to disclose.
   *  @returns a new classifier
   */
  disclose<const PropertyName extends keyof Jsonify<Secret>>(disclose: PropertyName) {
    // move the property from the secret type to the disclose type
    type NewDisclosed = Disclosed | Record<PropertyName, Jsonify<Secret>[PropertyName]>;
    type NewSecret = Omit<Secret, PropertyName>;

    // update the fluent interface
    const newDisclosed = [...this.disclosed, disclose] as (keyof Jsonify<NewDisclosed> &
      keyof Jsonify<Plaintext>)[];
    const classifier = new SecretClassifier<Plaintext, NewDisclosed, NewSecret>(
      // since `NewDisclosed` is opaque to the type checker, it's necessary
      // to assert the type of the array here.
      Object.freeze(newDisclosed),
      this.excluded,
    );

    return classifier;
  }

  /** Classify a property as excluded.
   *  @type {PropertyName} Available secrets to exclude.
   *  @param exclude The property name to exclude.
   *  @returns a new classifier
   */
  exclude<const PropertyName extends keyof Secret>(excludedPropertyName: PropertyName) {
    // remove the property from the secret type
    type NewConfidential = Omit<Secret, PropertyName>;

    // update the fluent interface
    const newExcluded = [...this.excluded, excludedPropertyName] as (keyof Plaintext)[];
    const classifier = new SecretClassifier<Plaintext, Disclosed, NewConfidential>(
      this.disclosed,
      Object.freeze(newExcluded),
    );

    return classifier;
  }

  /** Partitions `secret` into its disclosed properties and secret properties.
   *  @param value The object to partition
   *  @returns an object that classifies secrets.
   *    The `disclosed` member is new and contains disclosed properties.
   *    The `secret` member is a copy of the secret parameter, including its
   *    prototype, with all disclosed and excluded properties deleted.
   */
  classify(value: Plaintext): { disclosed: Jsonify<Disclosed>; secret: Jsonify<Secret> } {
    // need to JSONify during classification because the prototype is almost guaranteed
    // to be invalid when this  method deletes arbitrary properties.
    const secret = JSON.parse(JSON.stringify(value)) as Record<keyof Plaintext, unknown>;

    for (const excludedProp of this.excluded) {
      delete secret[excludedProp];
    }

    const disclosed: Record<PropertyKey, unknown> = {};
    for (const disclosedProp of this.disclosed) {
      // disclosedProp is known to be a subset of the keys of `Plaintext`, so these
      // type assertions are accurate.
      // FIXME: prove it to the compiler
      disclosed[disclosedProp] = secret[disclosedProp as keyof Plaintext];
      delete secret[disclosedProp as keyof Plaintext];
    }

    return {
      disclosed: disclosed as Jsonify<Disclosed>,
      secret: secret as Jsonify<Secret>,
    };
  }

  /** Merges the properties of `secret` and `disclosed`. When `secret` and
   *  `disclosed` contain the same property, the `secret` property overrides
   *  the `disclosed` property.
   *  @param disclosed an object whose disclosed properties are merged into
   *    the output. Unknown properties are ignored.
   *  @param secret an objects whose properties are merged into the output.
   *    Excluded properties are ignored. Unknown properties are retained.
   *  @returns a new object containing the merged data.
   */
  // Declassified data is always jsonified--the purpose of classifying it is to Jsonify it,
  // which causes type conversions.
  declassify(disclosed: Jsonify<Disclosed>, secret: Jsonify<Secret>): Jsonify<Plaintext> {
    // removed unknown keys from `disclosed` to prevent any old edit
    // of plaintext data from being laundered though declassification.
    const cleaned = {} as Partial<Jsonify<Disclosed>>;
    for (const disclosedProp of this.disclosed) {
      cleaned[disclosedProp] = disclosed[disclosedProp];
    }

    // merge decrypted into cleaned so that secret data clobbers public data
    const merged: any = Object.assign(cleaned, secret);

    // delete excluded props
    for (const excludedProp of this.excluded) {
      delete merged[excludedProp];
    }

    return merged as Jsonify<Plaintext>;
  }
}
