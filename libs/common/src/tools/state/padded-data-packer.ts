import { Jsonify } from "type-fest";

import { Utils } from "../../platform/misc/utils";

import { DataPacker as DataPackerAbstraction } from "./data-packer.abstraction";

const DATA_PACKING = Object.freeze({
  /** The character to use for padding. */
  padding: "0",

  /** The character dividing packed data. */
  divider: "|",

  /** A regular expression for detecting invalid padding. When the character
   *  changes, this should be updated to include the new padding pattern.
   */
  hasInvalidPadding: /[^0]/,
});

/** A packing strategy that conceals the length of secret data by padding it
 *  to a multiple of the frame size.
 *  @example
 *  // packed === "24|e2Zvbzp0cnVlfQ==|0000"
 *  const packer = new SecretPacker(24);
 *  const packed = packer.pack({ foo: true });
 */
export class PaddedDataPacker extends DataPackerAbstraction {
  /** Instantiates the padded data packer
   *  @param frameSize The size of the dataframe used to pad encrypted values.
   */
  constructor(private readonly frameSize: number) {
    super();
  }

  /**
   * Packs value into a string format that conceals the length by obscuring it
   * with the frameSize.
   * @see {@link DataPackerAbstraction.unpack}
   */
  pack<Secret>(value: Jsonify<Secret>) {
    // encode the value
    const json = JSON.stringify(value);
    const b64 = Utils.fromUtf8ToB64(json);

    // calculate packing metadata
    const frameSize = JSON.stringify(this.frameSize);
    const separatorLength = 2 * DATA_PACKING.divider.length; // there are 2 separators
    const payloadLength = b64.length + frameSize.length + separatorLength;
    const paddingLength = this.frameSize - (payloadLength % this.frameSize);

    // pack the data, thereby concealing its length
    const padding = DATA_PACKING.padding.repeat(paddingLength);
    const packed = `${frameSize}|${b64}|${padding}`;

    return packed;
  }

  /** {@link DataPackerAbstraction.unpack} */
  unpack<Secret>(secret: string): Jsonify<Secret> {
    // frame size is stored before the JSON payload in base 10
    const frameEndIndex = secret.indexOf(DATA_PACKING.divider);
    if (frameEndIndex < 1) {
      throw new Error("missing frame size");
    }
    const frameSize = parseInt(secret.slice(0, frameEndIndex), 10);
    const dataStartIndex = frameEndIndex + 1;

    // The decrypted string should be a multiple of the frame length
    if (secret.length % frameSize > 0) {
      throw new Error("invalid length");
    }

    // encoded data terminates with the divider, followed by the padding character
    const dataEndIndex = secret.lastIndexOf(DATA_PACKING.divider);
    if (dataEndIndex == frameEndIndex) {
      throw new Error("missing json object");
    }
    const paddingStartIndex = dataEndIndex + 1;

    // If the padding contains invalid padding characters then the padding could be used
    // as a side channel for arbitrary data.
    if (secret.slice(paddingStartIndex).match(DATA_PACKING.hasInvalidPadding)) {
      throw new Error("invalid padding");
    }

    // remove frame size and padding
    const b64 = secret.slice(dataStartIndex, dataEndIndex);

    // unpack the stored data
    const json = Utils.fromB64ToUtf8(b64);
    const unpacked = JSON.parse(json);

    return unpacked;
  }
}
