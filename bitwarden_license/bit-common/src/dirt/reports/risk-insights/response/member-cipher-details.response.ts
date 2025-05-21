import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class MemberCipherDetailsResponse extends BaseResponse {
  userName: string;
  email: string;
  useKeyConnector: boolean;
  cipherIds: string[] = [];

  constructor(response: any) {
    super(response);
    this.userName = this.getResponseProperty("UserName");
    this.email = this.getResponseProperty("Email");
    this.useKeyConnector = this.getResponseProperty("UseKeyConnector");
    this.cipherIds = this.getResponseProperty("CipherIds");
  }
}
