import { Jsonify } from "type-fest";

import { AttachmentView as SdkAttachmentView, SymmetricKey } from "@bitwarden/sdk-internal";

import { DECRYPT_ERROR } from "../../../key-management/crypto/models/enc-string";
import { View } from "../../../models/view/view";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { Attachment } from "../domain/attachment";

export class AttachmentView implements View {
  id?: string;
  url?: string;
  size?: string;
  sizeName?: string;
  fileName?: string;
  key?: SymmetricCryptoKey;
  private _hasDecryptionError?: boolean;

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
        return parseInt(this.size);
      }
    } catch {
      // Invalid file size.
    }
    return 0;
  }

  get hasDecryptionError(): boolean {
    return this._hasDecryptionError || this.fileName === DECRYPT_ERROR;
  }

  set hasDecryptionError(value: boolean) {
    this._hasDecryptionError = value;
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
      key: (this.key?.toBase64() ?? undefined) as SymmetricKey | undefined,
    };
  }

  /**
   * Converts the SDK AttachmentView to a AttachmentView.
   */
  static fromSdkAttachmentView(
    obj: SdkAttachmentView,
    failure = false,
  ): AttachmentView | undefined {
    if (!obj) {
      return undefined;
    }

    const view = new AttachmentView();
    view.id = obj.id;
    view.url = obj.url;
    view.size = obj.size;
    view.sizeName = obj.sizeName;
    view.fileName = obj.fileName;
    view.key = obj.key ? SymmetricCryptoKey.fromString(obj.key) : undefined;
    view._hasDecryptionError = failure;

    return view;
  }

  /**
   * Determines if the attachment is a legacy attachment without a per-attachment key.
   * In this case, the attachment is encrypted with the user's user-key
   */
  isLegacyAttachment(): boolean {
    return this.key == null;
  }
}
