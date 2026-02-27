import { Jsonify } from "type-fest";

import { SshKeyView as SdkSshKeyView } from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class SshKeyView extends ItemView {
  privateKey!: string;
  publicKey!: string;
  keyFingerprint!: string;

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

    sshKeyView.privateKey = obj.privateKey;
    sshKeyView.publicKey = obj.publicKey;
    sshKeyView.keyFingerprint = obj.fingerprint;

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
