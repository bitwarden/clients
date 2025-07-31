// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Attachment as SdkAttachment } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { AttachmentData } from "../data/attachment.data";
import { AttachmentView } from "../view/attachment.view";

export class Attachment extends Domain {
  id: string;
  url: string;
  size: string;
  sizeName: string; // Readable size, ex: "4.2 KB" or "1.43 GB"
  key: EncString;
  fileName: EncString;

  constructor(obj?: AttachmentData) {
    super();
    if (obj == null) {
      return;
    }

    this.size = obj.size;
    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        url: null,
        sizeName: null,
        fileName: null,
        key: null,
      },
      ["id", "url", "sizeName"],
    );
  }

  async decrypt(
    orgId: string,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<AttachmentView> {
    const view = await this.decryptObj<Attachment, AttachmentView>(
      this,
      new AttachmentView(this),
      ["fileName"],
      orgId,
      encKey,
      "DomainType: Attachment; " + context,
    );

    if (this.key != null) {
      view.key = await this.decryptAttachmentKey(orgId, encKey);
      view.encryptedKey = this.key; // Keep the encrypted key for the view
    }

    return view;
  }

  private async decryptAttachmentKey(orgId: string, encKey?: SymmetricCryptoKey) {
    try {
      if (encKey == null) {
        encKey = await this.getKeyForDecryption(orgId);
      }

      const encryptService = Utils.getContainerService().getEncryptService();
      const decValue = await encryptService.unwrapSymmetricKey(this.key, encKey);
      return decValue;
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // TODO: error?
    }
  }

  private async getKeyForDecryption(orgId: string) {
    const keyService = Utils.getContainerService().getKeyService();
    return orgId != null
      ? await keyService.getOrgKey(orgId)
      : await keyService.getUserKeyWithLegacySupport();
  }

  toAttachmentData(): AttachmentData {
    const a = new AttachmentData();
    a.size = this.size;
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

  static fromJSON(obj: Partial<Jsonify<Attachment>>): Attachment {
    if (obj == null) {
      return null;
    }

    const key = EncString.fromJSON(obj.key);
    const fileName = EncString.fromJSON(obj.fileName);

    return Object.assign(new Attachment(), obj, {
      key,
      fileName,
    });
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
  static fromSdkAttachment(obj: SdkAttachment): Attachment | undefined {
    if (!obj) {
      return undefined;
    }

    const attachment = new Attachment();
    attachment.id = obj.id;
    attachment.url = obj.url;
    attachment.size = obj.size;
    attachment.sizeName = obj.sizeName;
    attachment.fileName = EncString.fromJSON(obj.fileName);
    attachment.key = EncString.fromJSON(obj.key);

    return attachment;
  }
}
