import { Jsonify } from "type-fest";

import { Attachment as SdkAttachment } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { AttachmentData } from "../data/attachment.data";
import { AttachmentView } from "../view/attachment.view";

export class Attachment extends Domain {
  id?: string;
  url?: string;
  size?: string;
  sizeName?: string; // Readable size, ex: "4.2 KB" or "1.43 GB"
  key?: EncString;
  fileName?: EncString;

  constructor(obj?: AttachmentData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.url = obj.url;
    this.size = obj.size;
    this.sizeName = obj.sizeName;
    this.fileName = conditionalEncString(obj.fileName);
    this.key = conditionalEncString(obj.key);
  }

  async decrypt(
    decryptionKey: SymmetricCryptoKey,
    context = "No Cipher Context",
  ): Promise<AttachmentView> {
    const view = await this.decryptObj<Attachment, AttachmentView>(
      this,
      new AttachmentView(this),
      ["fileName"],
      decryptionKey,
      "DomainType: Attachment; " + context,
    );

    if (this.key != null) {
      view.key = await this.decryptAttachmentKey(decryptionKey);
      view.encryptedKey = this.key; // Keep the encrypted key for the view
    }

    return view;
  }

  private async decryptAttachmentKey(
    decryptionKey: SymmetricCryptoKey,
  ): Promise<SymmetricCryptoKey | undefined> {
    try {
      if (this.key == null) {
        return undefined;
      }

      const encryptService = Utils.getContainerService().getEncryptService();
      const decValue = await encryptService.unwrapSymmetricKey(this.key, decryptionKey);
      return decValue;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Attachment] Error decrypting attachment", e);
      return undefined;
    }
  }

  toAttachmentData(): AttachmentData {
    const a = new AttachmentData();
    if (this.size != null) {
      a.size = this.size;
    }
    this.buildDataModel(
      this,
      a,
      {
        id: null,
        url: null,
        sizeName: null,
        fileName: null,
        key: null,
      },
      ["id", "url", "sizeName"],
    );
    return a;
  }

  static fromJSON(obj: Partial<Jsonify<Attachment>> | undefined): Attachment | undefined {
    if (obj == null) {
      return undefined;
    }

    const attachment = new Attachment();
    attachment.id = obj.id;
    attachment.url = obj.url;
    attachment.size = obj.size;
    attachment.sizeName = obj.sizeName;
    attachment.key = encStringFrom(obj.key);
    attachment.fileName = encStringFrom(obj.fileName);

    return attachment;
  }

  /**
   * Maps to SDK Attachment
   *
   * @returns {SdkAttachment} - The SDK Attachment object
   */
  toSdkAttachment(): SdkAttachment {
    return {
      id: this.id,
      url: this.url,
      size: this.size,
      sizeName: this.sizeName,
      fileName: this.fileName?.toSdk(),
      key: this.key?.toSdk(),
    };
  }

  /**
   * Maps an SDK Attachment object to an Attachment
   * @param obj - The SDK attachment object
   */
  static fromSdkAttachment(obj?: SdkAttachment): Attachment | undefined {
    if (!obj) {
      return undefined;
    }

    const attachment = new Attachment();
    attachment.id = obj.id;
    attachment.url = obj.url;
    attachment.size = obj.size;
    attachment.sizeName = obj.sizeName;
    attachment.fileName = encStringFrom(obj.fileName);
    attachment.key = encStringFrom(obj.key);

    return attachment;
  }
}
