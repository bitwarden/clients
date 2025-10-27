import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey, UserKey } from "@bitwarden/common/types/key";
import { Attachment as SdkAttachment } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

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
    userId: UserId,
    orgId: string | undefined,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<AttachmentView> {
    const view = await this.decryptObj<Attachment, AttachmentView>(
      this,
      new AttachmentView(this),
      ["fileName"],
      userId,
      orgId ?? null,
      encKey,
      "DomainType: Attachment; " + context,
    );

    if (this.key != null) {
      view.key = await this.decryptAttachmentKey(orgId, userId, encKey);
      view.encryptedKey = this.key; // Keep the encrypted key for the view
    }

    return view;
  }

  private async decryptAttachmentKey(
    orgId: string | undefined,
    userId: UserId,
    encKey?: SymmetricCryptoKey,
  ): Promise<SymmetricCryptoKey | undefined> {
    try {
      if (this.key == null) {
        return undefined;
      }

      if (encKey == null) {
        const key = await this.getKeyForDecryption(orgId, userId);

        // If we don't have a key, we can't decrypt
        if (key == null) {
          return undefined;
        }

        encKey = key;
      }

      const encryptService = Utils.getContainerService().getEncryptService();
      const decValue = await encryptService.unwrapSymmetricKey(this.key, encKey);
      return decValue;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Attachment] Error decrypting attachment", e);
      return undefined;
    }
  }

  private async getKeyForDecryption(
    orgId: string | undefined,
    userId: UserId,
  ): Promise<OrgKey | UserKey | null> {
    const keyService = Utils.getContainerService().getKeyService();
    return orgId != null
      ? await firstValueFrom(
          keyService
            .orgKeys$(userId)
            .pipe(map((orgKeys) => (orgKeys ? (orgKeys[orgId as OrganizationId] ?? null) : null))),
        )
      : await firstValueFrom(keyService.userKey$(userId));
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
