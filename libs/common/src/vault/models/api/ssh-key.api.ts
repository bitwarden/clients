import { BaseResponse } from "../../../models/response/base.response";

export class SSHKeyApi extends BaseResponse {
  privateKey: string;
  publicKey: string;
  keyAlgorithm: string;
  keyFingerprint: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.privateKey = this.getResponseProperty("PrivateKey");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.keyAlgorithm = this.getResponseProperty("KeyAlgorithm");
    this.keyFingerprint = this.getResponseProperty("KeyFingerprint");
  }
}
