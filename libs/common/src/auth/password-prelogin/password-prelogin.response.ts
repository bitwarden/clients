import { KdfConfigResponse } from "../../key-management/models/response/kdf-config.response";
import { BaseResponse } from "../../models/response/base.response";

export class PasswordPreloginResponse extends BaseResponse {
  kdfSettings: KdfConfigResponse;

  /** Null for accounts that predate the salt column. */
  salt: string | null;

  constructor(response: any) {
    super(response);
    this.kdfSettings = new KdfConfigResponse(this.getResponseProperty("KdfSettings"));
    // getResponseProperty yields undefined, not null, for an absent key. Collapsing both to
    // null keeps this field's declared type honest for every response shape.
    this.salt = this.getResponseProperty("Salt") ?? null;
  }
}
