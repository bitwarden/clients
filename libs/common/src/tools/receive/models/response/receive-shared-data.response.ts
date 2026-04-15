import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class ReceiveSharedDataResponse extends BaseResponse {
  name: EncString;
  scekWrappedPublicKey: EncString;
  ownerEmail: string;

  constructor(response: any) {
    super(response);

    const name = this.getResponseProperty("name");
    if (name) {
      this.name = new EncString(name);
    } else {
      throw new Error("Missing name in response");
    }

    const publicKey = this.getResponseProperty("scekWrappedPublicKey");
    if (publicKey) {
      this.scekWrappedPublicKey = new EncString(publicKey);
    } else {
      throw new Error("Missing scekWrappedPublicKey in response");
    }

    const ownerEmail = this.getResponseProperty("ownerEmail");
    if (ownerEmail) {
      this.ownerEmail = ownerEmail;
    } else {
      throw new Error("Missing ownerEmail in response");
    }
  }
}
