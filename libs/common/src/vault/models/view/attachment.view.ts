// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { AttachmentView as SdkAttachmentView } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { Attachment } from "../domain/attachment";

export class AttachmentView implements View {
  id: string = null;
  url: string = null;
  size: string = null;
  sizeName: string = null;
  fileName: string = null;
  key: SymmetricCryptoKey = null;
  /**
   * The SDK returns an encrypted key for the attachment.
   */
  encryptedKey: EncString | undefined;

  constructor(a?: Attachment) {
    if (!a) {
      return;
    }

    this.id = a.id;
    this.url = a.url;
    this.size = a.size;
    this.sizeName = a.sizeName;
  }

  get fileSize(): number {
    try {
      if (this.size != null) {
        return parseInt(this.size, null);
      }
    } catch {
      // Invalid file size.
    }
    return 0;
  }

  static fromJSON(obj: Partial<Jsonify<AttachmentView>>): AttachmentView {
    const key = obj.key == null ? null : SymmetricCryptoKey.fromJSON(obj.key);
    return Object.assign(new AttachmentView(), obj, { key: key });
  }

  /**
   * Converts the AttachmentView to a SDK AttachmentView.
   */
  toSdkAttachmentView(): SdkAttachmentView {
    return {
      id: this.id,
      url: this.url,
      size: this.size,
      sizeName: this.sizeName,
      fileName: this.fileName,
      key: this.encryptedKey?.toJSON(),
    };
  }

  /**
   * Converts the SDK AttachmentView to a AttachmentView.
   */
  static fromSdkAttachmentView(obj: SdkAttachmentView): AttachmentView | undefined {
    if (!obj) {
      return undefined;
    }

    const view = new AttachmentView();
    view.id = obj.id ?? null;
    view.url = obj.url ?? null;
    view.size = obj.size ?? null;
    view.sizeName = obj.sizeName ?? null;
    view.fileName = obj.fileName ?? null;
    view.encryptedKey = new EncString(obj.key);

    return view;
  }
}
