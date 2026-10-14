import { Jsonify } from "type-fest";

import { SendEncryptionType, SendItem as SdkSendItem } from "@bitwarden/sdk-internal";

import { asUuid, uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import Domain from "../../../../platform/models/domain/domain-base";
import { SendItemMetadataData } from "../data/send-item-metadata.data";
import { SendItemData } from "../data/send-item.data";

export class SendItem extends Domain {
  encryptionVersion: SendEncryptionType = SendEncryptionType.V1;
  /**
   * Opaque sealed cipher blob. Only the SDK seals and unseals it, so every layer here passes the
   * string through verbatim — parsing or re-serializing it corrupts the wire value.
   */
  data?: string;
  /** Unencrypted metadata carried alongside {@link data}; the SDK restores the item id from it. */
  metadata?: SendItemMetadataData;

  constructor(obj?: SendItemData) {
    super();
    if (obj == null) {
      return;
    }

    if (obj.encryptionVersion) {
      this.encryptionVersion = obj.encryptionVersion;
    }
    this.data = obj.data;
    this.metadata = obj.metadata;
  }

  static fromJSON(json: Jsonify<SendItem>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItem(), json);
  }

  /** Maps this domain `SendItem` to the SDK `SendItem` shape. */
  toSdk(): SdkSendItem {
    if (this.data == null) {
      throw new Error("Item Send is missing its item data");
    }
    if (this.metadata == null) {
      throw new Error("Item Send is missing its item metadata");
    }

    return {
      encryptionVersion: this.encryptionVersion,
      data: this.data,
      metadata: { itemId: asUuid(this.metadata.itemId) },
    };
  }

  /** Maps an SDK `SendItem` back to a domain `SendItem`. */
  static fromSdk(obj: SdkSendItem): SendItem {
    return Object.assign(new SendItem(), {
      encryptionVersion: obj.encryptionVersion,
      data: obj.data,
      metadata: { itemId: uuidAsString(obj.metadata.itemId) },
    });
  }

  /** Serializes this domain `SendItem` to its `SendItemData` (string-shaped) form. */
  toSendData(): SendItemData {
    return Object.assign(new SendItemData(), {
      encryptionVersion: this.encryptionVersion,
      data: this.data,
      metadata: this.metadata,
    });
  }
}
