import { Jsonify } from "type-fest";

import { SendEncryptionType, SendItem as SdkSendItem } from "@bitwarden/sdk-internal";

import Domain from "../../../../platform/models/domain/domain-base";
import { Cipher } from "../../../../vault/models/domain/cipher";
import { SendItemData } from "../data/send-item.data";

export class SendItem extends Domain {
  encryptionVersion: SendEncryptionType = SendEncryptionType.V1;
  data: Cipher = new Cipher();

  constructor(obj?: SendItemData) {
    super();
    if (obj == null) {
      return;
    }

    if (obj.encryptionVersion) {
      this.encryptionVersion = obj.encryptionVersion;
    }
    let cipher: Cipher | undefined;
    try {
      cipher = obj?.data != null ? Cipher.fromJSON(JSON.parse(obj.data)) : undefined;
    } catch {
      cipher = undefined;
    }

    if (cipher) {
      this.data = cipher;
    }
  }

  static fromJSON(json: Jsonify<SendItem>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItem(), json, {
      data: Cipher.fromJSON(json.data),
    });
  }

  /** Maps this domain `SendItem` to the SDK `SendItem` shape. */
  toSdk(): SdkSendItem {
    return {
      encryptionVersion: this.encryptionVersion,
      data: this.data.toSdkCipher(),
    };
  }

  /** Maps an SDK `SendItem` back to a domain `SendItem`. */
  static fromSdk(obj: SdkSendItem): SendItem {
    return Object.assign(new SendItem(), {
      encryptionVersion: obj.encryptionVersion,
      data: Cipher.fromSdkCipher(obj.data),
    });
  }

  /** Serializes this domain `SendItem` to its `SendItemData` (string-shaped) form. */
  toSendData(): SendItemData {
    return Object.assign(new SendItemData(), {
      encryptionVersion: this.encryptionVersion,
      data: JSON.stringify(this.data),
    });
  }
}
