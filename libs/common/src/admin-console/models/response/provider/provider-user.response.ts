import { BaseResponse } from "../../../../models/response/base.response";
import { ProviderUserStatusType, ProviderUserType } from "../../../enums";
import { PermissionsApi } from "../../api/permissions.api";

export class ProviderUserResponse extends BaseResponse {
  id: string;
  userId: string;
  type: ProviderUserType;
  status: ProviderUserStatusType;
  permissions: PermissionsApi;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
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
