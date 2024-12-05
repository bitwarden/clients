// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SshKeyApi } from "../api/ssh-key.api";

export class SshKeyData {
  privateKey: string;
  publicKey: string;
  keyFingerprint: string;

  constructor(data?: SshKeyApi) {
    if (data == null) {
      return;
    }

    this.privateKey = data.privateKey;
    this.publicKey = data.publicKey;
    this.keyFingerprint = data.keyFingerprint;
  }
}
