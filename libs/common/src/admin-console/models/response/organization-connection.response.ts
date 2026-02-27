// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BillingSyncConfigApi } from "../../../billing/models/api/billing-sync-config.api";
import { BaseResponse } from "../../../models/response/base.response";
import { OrganizationConnectionType } from "../../enums";
import { ScimConfigApi } from "../api/scim-config.api";

/**API response config types for OrganizationConnectionResponse */
export type OrganizationConnectionConfigApis = BillingSyncConfigApi | ScimConfigApi;

export class OrganizationConnectionResponse<
  TConfig extends OrganizationConnectionConfigApis,
> extends BaseResponse {
  id: string;
  type: OrganizationConnectionType;
  organizationId: string;
  enabled: boolean;
  config: TConfig;

  constructor(response: any, configType: { new (response: any): TConfig }) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.type = this.getResponseProperty("Type");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.enabled = this.getResponseProperty("Enabled");
    const rawConfig = this.getResponseProperty("Config");
    this.config = rawConfig == null ? null : new configType(rawConfig);
  }
}
