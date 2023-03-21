import { ProviderUserStatusType } from "../../enums/providerUserStatusType";
import { ProviderUserType } from "../../enums/providerUserType";
import { Guid } from "../../types/guid";
import { PermissionsApi } from "../api/permissions.api";

import { BaseResponse } from "./base.response";

export class ProfileProviderResponse extends BaseResponse {
  id: Guid;
  name: string;
  key: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  permissions: PermissionsApi;
  userId: Guid;
  useEvents: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.name = this.getResponseProperty("Name");
    this.key = this.getResponseProperty("Key");
    this.status = this.getResponseProperty("Status");
    this.type = this.getResponseProperty("Type");
    this.enabled = this.getResponseProperty("Enabled");
    this.permissions = new PermissionsApi(this.getResponseProperty("permissions"));
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.useEvents = this.getResponseProperty("UseEvents");
  }
}
