import { KdfConfigResponse } from "../../key-management/models/response/kdf-config.response";
import { BaseResponse } from "../../models/response/base.response";

export class PasswordPreloginResponse extends BaseResponse {
  kdfSettings: KdfConfigResponse;
  /**
   * The server declares this `string?` and returns the `User.MasterPasswordSalt` column
   * verbatim. That column is nullable and was never backfilled, so this can be null.
   */
  salt: string | null;

  constructor(response: any) {
    super(response);
    this.kdfSettings = new KdfConfigResponse(this.getResponseProperty("KdfSettings"));
    // getResponseProperty returns undefined, not null, when the key is absent.
    this.salt = this.getResponseProperty("Salt") ?? null;
  }
}
