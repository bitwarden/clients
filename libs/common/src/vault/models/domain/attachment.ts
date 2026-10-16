import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { Attachment as SdkAttachment } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
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
    this.fileName = conditionalEncString(obj.fileName);
    this.key = conditionalEncString(obj.key);
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
