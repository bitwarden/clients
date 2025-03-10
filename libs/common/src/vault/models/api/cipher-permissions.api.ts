import { Jsonify } from "type-fest";

import { BaseResponse } from "../../../models/response/base.response";

export class CipherPermissionsApi extends BaseResponse {
  delete: boolean = false;
  restore: boolean = false;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.delete = this.getResponseProperty("Delete");
    this.restore = this.getResponseProperty("Restore");
  }

  static fromJSON(obj: Jsonify<CipherPermissionsApi>) {
    return Object.assign(new CipherPermissionsApi(), obj);
  }
}
