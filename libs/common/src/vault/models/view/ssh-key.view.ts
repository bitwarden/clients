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

  // New metadata to preserve original encrypted PEM and passphrase handling
  originalPrivateKey?: string = null;
  isEncrypted?: boolean = null;
  sshKeyPassphrase?: string = null;

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

  /**
   * Converts the SDK SshKeyView to a SshKeyView.
   */
  static fromSdkSshKeyView(obj: SdkSshKeyView): SshKeyView | undefined {
    if (!obj) {
      return undefined;
    }

    const sshKeyView = new SshKeyView();

    // Prefer showing the original PEM if present (keeps encrypted header intact)
    sshKeyView.originalPrivateKey = (obj as any).originalPrivateKey ?? null;
    sshKeyView.isEncrypted = (obj as any).isEncrypted ?? null;
    sshKeyView.sshKeyPassphrase = (obj as any).sshKeyPassphrase ?? null;

    sshKeyView.privateKey = (sshKeyView.originalPrivateKey ?? obj.privateKey) ?? null;
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
      // Preserve metadata if present
      ...(this.originalPrivateKey != null ? { originalPrivateKey: this.originalPrivateKey } : {}),
      ...(this.isEncrypted != null ? { isEncrypted: this.isEncrypted } : {}),
      ...(this.sshKeyPassphrase != null ? { sshKeyPassphrase: this.sshKeyPassphrase } : {}),
    } as unknown as SdkSshKeyView;
  }
}
