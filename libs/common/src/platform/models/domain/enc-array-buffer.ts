// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "../../../platform/misc/utils";
import { EncryptionType } from "../../enums";
import { Encrypted } from "../../interfaces/encrypted";

const ENC_TYPE_LENGTH = 1;
const IV_LENGTH = 16;
const MAC_LENGTH = 32;
const MIN_DATA_LENGTH = 1;

export class EncArrayBuffer implements Encrypted {
  readonly encryptionType: EncryptionType = null;
  readonly dataBytes: Uint8Array = null;
  readonly ivBytes: Uint8Array = null;
  readonly macBytes: Uint8Array = null;

  constructor(readonly buffer: Uint8Array) {
    const encBytes = buffer;
    const encType = encBytes[0];

    switch (encType) {
      case EncryptionType.AesCbc256_HmacSha256_B64: {
        const minimumLength = ENC_TYPE_LENGTH + IV_LENGTH + MAC_LENGTH + MIN_DATA_LENGTH;
        if (encBytes.length < minimumLength) {
          this.throwDecryptionError();
        }

        this.ivBytes = encBytes.slice(ENC_TYPE_LENGTH, ENC_TYPE_LENGTH + IV_LENGTH);
        this.macBytes = encBytes.slice(
          ENC_TYPE_LENGTH + IV_LENGTH,
          ENC_TYPE_LENGTH + IV_LENGTH + MAC_LENGTH,
        );
        this.dataBytes = encBytes.slice(ENC_TYPE_LENGTH + IV_LENGTH + MAC_LENGTH);
        break;
      }
      case EncryptionType.AesCbc256_B64: {
        const minimumLength = ENC_TYPE_LENGTH + IV_LENGTH + MIN_DATA_LENGTH;
        if (encBytes.length < minimumLength) {
          this.throwDecryptionError();
        }

        this.ivBytes = encBytes.slice(ENC_TYPE_LENGTH, ENC_TYPE_LENGTH + IV_LENGTH);
        this.dataBytes = encBytes.slice(ENC_TYPE_LENGTH + IV_LENGTH);
        break;
      }
      default:
        this.throwDecryptionError();
    }

    this.encryptionType = encType;
  }

  private throwDecryptionError() {
    throw new Error(
      "Error parsing encrypted ArrayBuffer: data is corrupted or has an invalid format.",
    );
  }

  static fromParts(
    encryptionType: EncryptionType,
    iv: Uint8Array,
    data: Uint8Array,
    mac: Uint8Array | undefined | null,
  ) {
    if (encryptionType == null || iv == null || data == null) {
      throw new Error("encryptionType, iv, and data must be provided");
    }

    switch (encryptionType) {
      case EncryptionType.AesCbc256_B64:
      case EncryptionType.AesCbc256_HmacSha256_B64:
        EncArrayBuffer.validateIvLength(iv);
        EncArrayBuffer.validateMacLength(encryptionType, mac);
        break;
      default:
        throw new Error(`Unknown EncryptionType ${encryptionType} for EncArrayBuffer.fromParts`);
    }

    let macLen = 0;
    if (mac != null) {
      macLen = mac.length;
    }

    const bytes = new Uint8Array(1 + iv.byteLength + macLen + data.byteLength);
    bytes.set([encryptionType], 0);
    bytes.set(iv, 1);
    if (mac != null) {
      bytes.set(mac, 1 + iv.byteLength);
    }
    bytes.set(data, 1 + iv.byteLength + macLen);
    return new EncArrayBuffer(bytes);
  }

  static async fromResponse(response: {
    arrayBuffer: () => Promise<ArrayBuffer>;
  }): Promise<EncArrayBuffer> {
    const buffer = await response.arrayBuffer();
    if (buffer == null) {
      throw new Error("Cannot create EncArrayBuffer from Response - Response is empty");
    }
    return new EncArrayBuffer(new Uint8Array(buffer));
  }

  static fromB64(b64: string) {
    const buffer = Utils.fromB64ToArray(b64);
    return new EncArrayBuffer(buffer);
  }

  static validateIvLength(iv: Uint8Array) {
    if (iv == null || iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }
  }

  static validateMacLength(encType: EncryptionType, mac: Uint8Array | null | undefined) {
    switch (encType) {
      case EncryptionType.AesCbc256_B64:
        if (mac != null) {
          throw new Error("mac must not be provided for AesCbc256_B64");
        }
        break;
      case EncryptionType.AesCbc256_HmacSha256_B64:
        if (mac == null || mac.length !== MAC_LENGTH) {
          throw new Error("Invalid MAC length");
        }
        break;
      default:
        throw new Error("Invalid encryption type and mac combination");
    }
  }
}
