import { Jsonify } from "type-fest";

/** A packing strategy that packs data into a string.
 */
export abstract class DataPacker {
  /**
   * Packs value into a string format.
   * @type {Data} is the type of data being protected.
   * @param value is packed into the string
   * @returns the packed string
   */
  abstract pack<Data>(value: Jsonify<Data>): string;

  /** Unpacks a string produced by pack.
   * @param packedValue is the string to unpack
   * @type {Data} is the type of data being protected.
   * @returns the data stored within the secret.
   * @throws when `packedValue` has an invalid format.
   */
  abstract unpack<Data>(packedValue: string): Jsonify<Data>;
}
