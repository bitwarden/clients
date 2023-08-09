import { EncryptionType } from "../../../enums";
import { Utils } from "../../../platform/misc/utils";
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
      case EncryptionType.AesCbc128_HmacSha256_B64:
      case EncryptionType.AesCbc256_HmacSha256_B64: {
        const minimumLength = ENC_TYPE_LENGTH + IV_LENGTH + MAC_LENGTH + MIN_DATA_LENGTH;
        if (encBytes.length < minimumLength) {
          this.throwDecryptionError();
        }

        this.ivBytes = encBytes.slice(ENC_TYPE_LENGTH, ENC_TYPE_LENGTH + IV_LENGTH);
        this.macBytes = encBytes.slice(
          ENC_TYPE_LENGTH + IV_LENGTH,
          ENC_TYPE_LENGTH + IV_LENGTH + MAC_LENGTH
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
      "Error parsing encrypted ArrayBuffer: data is corrupted or has an invalid format."
    );
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
}
