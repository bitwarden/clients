// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SshKeyApi } from "../api/ssh-key.api";

export class SshKeyData {
  privateKey: string;
  publicKey: string;
  keyFingerprint: string;

  // New fields to preserve original encrypted key and optional passphrase
  originalPrivateKey?: string;
  isEncrypted?: boolean;
  sshKeyPassphrase?: string;

  constructor(data?: SshKeyApi) {
    if (data == null) {
      return;
    }

    this.privateKey = data.privateKey;
    this.publicKey = data.publicKey;
    this.keyFingerprint = data.keyFingerprint;

    // Map new optional properties if present
    this.originalPrivateKey = data.originalPrivateKey;
    this.isEncrypted = data.isEncrypted;
    this.sshKeyPassphrase = data.sshKeyPassphrase;
  }
}
