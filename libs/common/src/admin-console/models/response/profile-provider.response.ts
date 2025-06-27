import { BaseResponse } from "../../../models/response/base.response";
import {
  ProviderStatusType,
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "../../enums";
import { PermissionsApi } from "../api/permissions.api";

export class ProfileProviderResponse extends BaseResponse {
  id: string;
  name: string;
  key: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  permissions: PermissionsApi;
  userId: string;
  useEvents: boolean;
  providerStatus: ProviderStatusType;
  providerType: ProviderType;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.key = this.getResponseProperty("Key");
    this.status = this.getResponseProperty("Status");
    this.type = this.getResponseProperty("Type");
    this.enabled = this.getResponseProperty("Enabled");
    this.permissions = new PermissionsApi(this.getResponseProperty("permissions"));
    this.userId = this.getResponseProperty("UserId");
    this.useEvents = this.getResponseProperty("UseEvents");
    this.providerStatus = this.getResponseProperty("ProviderStatus");
    this.providerType = this.getResponseProperty("ProviderType");
  }
}
