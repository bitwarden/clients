import { Jsonify } from "type-fest";

import { SSHKey } from "../domain/ssh-key";

import { ItemView } from "./item.view";

export class SSHKeyView extends ItemView {
  privateKey: string = null;
  publicKey: string = null;
  keyFingerprint: string = null;
  keyAlgorithm: string = null;

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
