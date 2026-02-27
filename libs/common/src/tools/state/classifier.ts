import { Jsonify } from "type-fest";

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
export interface Classifier<Plaintext, Disclosed, Secret> {
  /** Partitions `secret` into its disclosed properties and secret properties.
   *  @param value The object to partition
   *  @returns an object that classifies secrets.
   *    The `disclosed` member is new and contains disclosed properties.
   *    The `secret` member is a copy of the secret parameter, including its
   *    prototype, with all disclosed and excluded properties deleted.
   */
  classify(value: Plaintext): { disclosed: Jsonify<Disclosed>; secret: Jsonify<Secret> };

  /** Merges the properties of `secret` and `disclosed`. When `secret` and
   *  `disclosed` contain the same property, the `secret` property overrides
   *  the `disclosed` property.
   *  @param disclosed an object whose disclosed properties are merged into
   *    the output. Unknown properties are ignored.
   *  @param secret an objects whose properties are merged into the output.
   *    Excluded properties are ignored. Unknown properties are retained.
   *  @returns a new object containing the merged data.
   *
   *  @remarks Declassified data is always jsonified--the purpose of classifying it is
   *   to Jsonify it,
   *   which causes type conversions.
   */
  declassify(disclosed: Jsonify<Disclosed>, secret: Jsonify<Secret>): Jsonify<Plaintext>;
}
