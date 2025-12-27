import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class MemberAccessResponse extends BaseResponse {
  userName: string;
  email: string;
  twoFactorEnabled: boolean;
  accountRecoveryEnabled: boolean;
  userGuid: Guid;
  userId?: string;
  avatarColor?: string;
  usesKeyConnector: boolean;

  cipherIds: Guid[] = [];
  collectionId: string;
  groupId: string;
  groupName: string;
  collectionName: EncString;
  itemCount: number;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;

  constructor(response: any) {
    super(response);
    this.userName = this.getResponseProperty("UserName");
    this.email = this.getResponseProperty("Email");
    this.twoFactorEnabled = this.getResponseProperty("TwoFactorEnabled");
    this.accountRecoveryEnabled = this.getResponseProperty("AccountRecoveryEnabled");
    this.userGuid = this.getResponseProperty("UserGuid");
    this.userId = this.getResponseProperty("UserId");
    this.avatarColor = this.getResponseProperty("AvatarColor");
    this.usesKeyConnector = this.getResponseProperty("UsesKeyConnector");

    this.cipherIds = this.getResponseProperty("CipherIds") || [];
    this.groupId = this.getResponseProperty("GroupId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.groupName = this.getResponseProperty("GroupName");
    this.collectionName = new EncString(this.getResponseProperty("CollectionName"));
    this.itemCount = this.getResponseProperty("ItemCount");
    this.readOnly = this.getResponseProperty("ReadOnly");
    this.hidePasswords = this.getResponseProperty("HidePasswords");
    this.manage = this.getResponseProperty("Manage");
  }
}
