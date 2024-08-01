import { Jsonify } from "type-fest";

import { SSHKey } from "../domain/ssh-key";

import { ItemView } from "./item.view";

export class SSHKeyView extends ItemView {
  constructor(n?: SSHKey) {
    super();
    if (!n) {
      return;
    }
  }

  get subTitle(): string {
    return null;
  }

  static fromJSON(obj: Partial<Jsonify<SSHKeyView>>): SSHKeyView {
    return Object.assign(new SSHKeyView(), obj);
  }
}
