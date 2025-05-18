import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { Guid } from "@bitwarden/common/types/guid";

export class MemberAccessDetails extends BaseResponse {
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

export class MemberAccessResponse extends BaseResponse {
  userName: string;
  email: string;
  twoFactorEnabled: boolean;
  accountRecoveryEnabled: boolean;
  collectionsCount: number;
  groupsCount: number;
  totalItemCount: number;
  accessDetails: MemberAccessDetails[] = [];
  userGuid: Guid;
  usesKeyConnector: boolean;

  constructor(response: any) {
    super(response);
    this.userName = this.getResponseProperty("UserName");
    this.email = this.getResponseProperty("Email");
    this.twoFactorEnabled = this.getResponseProperty("TwoFactorEnabled");
    this.accountRecoveryEnabled = this.getResponseProperty("AccountRecoveryEnabled");
    this.collectionsCount = this.getResponseProperty("CollectionsCount");
    this.groupsCount = this.getResponseProperty("GroupsCount");
    this.totalItemCount = this.getResponseProperty("TotalItemCount");
    this.userGuid = this.getResponseProperty("UserGuid");
    this.usesKeyConnector = this.getResponseProperty("UsesKeyConnector");

    const details = this.getResponseProperty("AccessDetails");
    if (details != null) {
      this.accessDetails = details.map((o: any) => new MemberAccessDetails(o));
    }
  }
}
