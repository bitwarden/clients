// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.

import { KdfConfigResponse } from "../../key-management/models/response/kdf-config.response";
import { BaseResponse } from "../../models/response/base.response";

export class PasswordPreloginResponse extends BaseResponse {
  kdfSettings: KdfConfigResponse;
  salt: string;

  constructor(response: any) {
    super(response);
    this.kdfSettings = this.getResponseProperty("KdfSettings");
    this.salt = this.getResponseProperty("Salt");
  }
}
