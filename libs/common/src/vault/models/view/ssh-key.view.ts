// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SshKeyView as SdkSshKeyView } from "@bitwarden/sdk-internal";

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

  static fromJSON(obj: Partial<Jsonify<SshKeyView>> | undefined): SshKeyView {
    return Object.assign(new SshKeyView(), obj);
  }

  /**
   * Converts the SDK SshKeyView to a SshKeyView.
   */
  static fromSdkSshKeyView(obj: SdkSshKeyView): SshKeyView {
    const sshKeyView = new SshKeyView();

    sshKeyView.privateKey = obj.privateKey ?? null;
    sshKeyView.publicKey = obj.publicKey ?? null;
    sshKeyView.keyFingerprint = obj.fingerprint ?? null;

    return sshKeyView;
  }

  /**
   * Converts the SshKeyView to an SDK SshKeyView.
   */
  toSdkSshKeyView(): SdkSshKeyView {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      fingerprint: this.keyFingerprint,
    };
  }
}
