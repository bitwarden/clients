// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

export class SshKeyApi extends BaseResponse {
  privateKey: string;
  publicKey: string;
  keyFingerprint: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.privateKey = this.getResponseProperty("PrivateKey");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.keyFingerprint = this.getResponseProperty("KeyFingerprint");
  }
}
