import { ProviderUserStatusType } from "../../../enums/providerUserStatusType";
import { ProviderUserType } from "../../../enums/providerUserType";
import { Guid } from "../../../types/guid";
import { PermissionsApi } from "../../api/permissions.api";
import { BaseResponse } from "../base.response";

export class ProviderUserResponse extends BaseResponse {
  id: Guid;
  userId: Guid;
  type: ProviderUserType;
  status: ProviderUserStatusType;
  permissions: PermissionsApi;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.permissions = new PermissionsApi(this.getResponseProperty("Permissions"));
  }
}

export class ProviderUserUserDetailsResponse extends ProviderUserResponse {
  name: string;
  email: string;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
  }
}
