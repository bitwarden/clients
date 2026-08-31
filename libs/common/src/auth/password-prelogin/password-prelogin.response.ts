import { KdfConfigResponse } from "../../key-management/models/response/kdf-config.response";
import { BaseResponse } from "../../models/response/base.response";

export class PasswordPreloginResponse extends BaseResponse {
  kdfSettings: KdfConfigResponse;
  salt: string;

  constructor(response: any) {
    super(response);
    this.kdfSettings = new KdfConfigResponse(this.getResponseProperty("KdfSettings"));
    this.salt = this.getResponseProperty("Salt");
  }
}
