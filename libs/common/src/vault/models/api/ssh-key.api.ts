// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

export class SshKeyApi extends BaseResponse {
  privateKey: string;
  publicKey: string;
  keyFingerprint: string;

  // New fields for lossless encrypted key preservation and UX
  originalPrivateKey?: string;
  isEncrypted?: boolean;
  sshKeyPassphrase?: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.privateKey = this.getResponseProperty("PrivateKey");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.keyFingerprint = this.getResponseProperty("KeyFingerprint");

    // Map new optional properties if present
    this.originalPrivateKey = this.getResponseProperty("OriginalPrivateKey");
    this.isEncrypted = this.getResponseProperty("IsEncrypted");
    this.sshKeyPassphrase = this.getResponseProperty("SshKeyPassphrase");
  }
}
