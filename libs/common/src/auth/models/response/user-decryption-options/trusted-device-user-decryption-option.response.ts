// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";
import { EncString } from "../../../../platform/models/domain/enc-string";

export interface ITrustedDeviceUserDecryptionOptionServerResponse {
  HasAdminApproval: boolean;
  HasLoginApprovingDevice: boolean;
  HasManageResetPasswordPermission: boolean;
  IsTdeOffboarding: boolean;
  EncryptedPrivateKey?: string;
  EncryptedUserKey?: string;
}

export class TrustedDeviceUserDecryptionOptionResponse extends BaseResponse {
  hasAdminApproval: boolean;
  hasLoginApprovingDevice: boolean;
  hasManageResetPasswordPermission: boolean;
  isTdeOffboarding: boolean;
  encryptedPrivateKey: EncString;
  encryptedUserKey: EncString;

  constructor(response: any) {
    super(response);
    this.hasAdminApproval = this.getResponseProperty("HasAdminApproval");

    this.hasLoginApprovingDevice = this.getResponseProperty("HasLoginApprovingDevice");
    this.hasManageResetPasswordPermission = this.getResponseProperty(
      "HasManageResetPasswordPermission",
    );

    this.isTdeOffboarding = this.getResponseProperty("IsTdeOffboarding");

    if (response.EncryptedPrivateKey) {
      this.encryptedPrivateKey = new EncString(this.getResponseProperty("EncryptedPrivateKey"));
    }
    if (response.EncryptedUserKey) {
      this.encryptedUserKey = new EncString(this.getResponseProperty("EncryptedUserKey"));
    }
  }
}
