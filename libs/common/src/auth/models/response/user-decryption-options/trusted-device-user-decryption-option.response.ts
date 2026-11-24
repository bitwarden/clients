// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

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
      this.encryptedPrivateKey = this.getResponseProperty("EncryptedPrivateKey") as EncString;
    }
    if (response.EncryptedUserKey) {
      this.encryptedUserKey = this.getResponseProperty("EncryptedUserKey") as EncString;
    }
  }
}
