// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SshKey } from "../domain/ssh-key";

import { ItemView } from "./item.view";

export class SshKeyView extends ItemView {
  privateKey: string = null;
  publicKey: string = null;
  keyFingerprint: string = null;

  constructor(n?: SshKey) {
    super();
    if (!n) {
      return;
    }
  }

  get maskedPrivateKey(): string {
    if (!this.privateKey || this.privateKey.length === 0) {
      return "";
    }

    let lines = this.privateKey.split("\n").filter((l) => l.trim() !== "");
    lines = lines.map((l, i) => {
      if (i === 0 || i === lines.length - 1) {
        return l;
      }
      return this.maskLine(l);
    });
    return lines.join("\n");
  }

  private maskLine(line: string): string {
    return "•".repeat(32);
  }

  get subTitle(): string {
    return this.keyFingerprint;
  }

  static fromJSON(obj: Partial<Jsonify<SshKeyView>>): SshKeyView {
    return Object.assign(new SshKeyView(), obj);
  }
}
