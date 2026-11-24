import { Jsonify } from "type-fest";

import { Attachment as SdkAttachment, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { AttachmentData } from "../data/attachment.data";

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
    this.fileName = (obj.fileName ?? undefined) as EncString;
    this.key = (obj.key ?? undefined) as EncString;
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
    attachment.key = obj.key ?? undefined;
    attachment.fileName = obj.fileName ?? undefined;

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
      fileName: this.fileName ?? undefined,
      key: this.key ?? undefined,
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
    attachment.fileName = obj.fileName ?? undefined;
    attachment.key = obj.key ?? undefined;

    return attachment;
  }
}
