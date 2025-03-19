// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SecureNoteType } from "../../enums";
import { SecureNote } from "../domain/secure-note";

import { ItemView } from "./item.view";

export class SecureNoteView extends ItemView {
  type: SecureNoteType = null;

  constructor(n?: SecureNote) {
    super();
    if (!n) {
      return;
    }

    this.type = n.type;
  }

  get subTitle(): string {
    return null;
  }

  static fromJSON(obj: Partial<Jsonify<SecureNoteView>>): SecureNoteView {
    return Object.assign(new SecureNoteView(), obj);
  }
}
