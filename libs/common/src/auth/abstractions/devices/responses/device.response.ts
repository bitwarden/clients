import { DeviceType } from "../../../../enums";
import { BaseResponse } from "../../../../models/response/base.response";

export interface DevicePendingAuthRequest {
  id: string;
  creationDate: string;
}

export class DeviceResponse extends BaseResponse {
  id: string;
  userId: string;
  name: string;
  identifier: string;
  type: DeviceType;
  creationDate: string;
  revisionDate: string;
  isTrusted: boolean;
  encryptedUserKey: string | null;
  encryptedPublicKey: string | null;

  devicePendingAuthRequest: DevicePendingAuthRequest | null;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.name = this.getResponseProperty("Name");
    this.identifier = this.getResponseProperty("Identifier");
    this.type = this.getResponseProperty("Type");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.isTrusted = this.getResponseProperty("IsTrusted");
    this.encryptedUserKey = this.getResponseProperty("EncryptedUserKey");
    this.encryptedPublicKey = this.getResponseProperty("EncryptedPublicKey");
    this.devicePendingAuthRequest = this.getResponseProperty("DevicePendingAuthRequest");
  }
}
