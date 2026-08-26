// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { SendEncryptionType, SendItem as SdkSendItem } from "@bitwarden/sdk-internal";

import Domain from "../../../../platform/models/domain/domain-base";
import { Cipher } from "../../../../vault/models/domain/cipher";
import { SendItemData } from "../data/send-item.data";
import { SendItemView } from "../view/send-item.view";

export class SendItem extends Domain {
  encryptionVersion: SendEncryptionType = SendEncryptionType.V1;
  data: Cipher;

  constructor(obj?: SendItemData) {
    super();
    if (obj == null) {
      return;
    }

    this.encryptionVersion = obj.encryptionVersion;
    this.data = Cipher.fromJSON(JSON.parse(obj.data));
  }

  async decrypt(key: SymmetricCryptoKey): Promise<SendItemView> {
    const cipherView = await this.data.decrypt(key);
    return {
      data: cipherView,
    };
  }

  static fromJSON(json: Jsonify<SendItem>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItem(), json);
  }

  /** Maps this domain `SendItem` to the SDK `SendItem` shape. */
  toSdk(): SdkSendItem {
    return {
      encryptionVersion: this.encryptionVersion,
      data: this.data.toSdkCipher(),
    };
  }

  /** Maps an SDK `SendItem` back to a domain `SendItem`. */
  static fromSdk(obj?: SdkSendItem): SendItem {
    if (obj == null) {
      return null;
    }

    return Object.assign(new SendItem(), {
      encryptionVersion: obj.encryptionVersion,
      data: obj.data,
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
