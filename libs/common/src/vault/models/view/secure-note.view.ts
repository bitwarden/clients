import { Jsonify } from "type-fest";

import { SecureNoteView as SdkSecureNoteView } from "@bitwarden/sdk-internal";

import { SecureNoteType } from "../../enums";
import { SecureNote } from "../domain/secure-note";

import { ItemView } from "./item.view";

// Mirrored in the SDK (bitwarden/sdk-internal: crates/bitwarden-vault/src/cipher/secure_note.rs).
// Field changes here must also be made there, along with the toSdk/fromSdk mappings.
export class SecureNoteView extends ItemView implements SdkSecureNoteView {
  type: SecureNoteType = SecureNoteType.Generic;

  constructor(n?: SecureNote) {
    super();
    if (!n) {
      return;
    }

    this.type = n.type;
  }

  get subTitle(): string | undefined {
    return undefined;
  }

  static fromJSON(obj: Partial<Jsonify<SecureNoteView>> | undefined): SecureNoteView {
    return Object.assign(new SecureNoteView(), obj);
  }

  /**
   * Converts the SDK SecureNoteView to a SecureNoteView.
   */
  static fromSdkSecureNoteView(obj: SdkSecureNoteView): SecureNoteView {
    const secureNoteView = new SecureNoteView();
    secureNoteView.type = obj.type;

    return secureNoteView;
  }

  /**
   * Converts the SecureNoteView to an SDK SecureNoteView.
   * The view implements the SdkView so we can safely return `this`
   */
  toSdkSecureNoteView(): SdkSecureNoteView {
    return this;
  }
}
