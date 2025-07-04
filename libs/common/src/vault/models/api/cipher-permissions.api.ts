import { Jsonify } from "type-fest";

import { CipherPermissions as SdkCipherPermissions } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../models/response/base.response";

export class CipherPermissionsApi extends BaseResponse implements SdkCipherPermissions {
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

  /**
   * Converts the SDK CipherPermissionsApi to a CipherPermissionsApi.
   */
  static fromSdkCipherPermissions(obj: SdkCipherPermissions): CipherPermissionsApi | undefined {
    if (!obj) {
      return undefined;
    }

    const permissions = new CipherPermissionsApi();
    permissions.delete = obj.delete;
    permissions.restore = obj.restore;

    return permissions;
  }

  /**
   * Converts the CipherPermissionsApi to an SdkCipherPermissions
   */
  toSdkCipherPermissions(): SdkCipherPermissions {
    return this;
  }
}
