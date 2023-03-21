import { OrganizationConnectionType } from "../../enums/organizationConnectionType";
import { Guid } from "../../types/guid";
import { BillingSyncConfigApi } from "../api/billing-sync-config.api";
import { ScimConfigApi } from "../api/scim-config.api";

import { BaseResponse } from "./base.response";

/**API response config types for OrganizationConnectionResponse */
export type OrganizationConnectionConfigApis = BillingSyncConfigApi | ScimConfigApi;

export class OrganizationConnectionResponse<
  TConfig extends OrganizationConnectionConfigApis
> extends BaseResponse {
  id: Guid;
  type: OrganizationConnectionType;
  organizationId: Guid;
  enabled: boolean;
  config: TConfig;

  constructor(response: any, configType: { new (response: any): TConfig }) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.type = this.getResponseProperty("Type");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.enabled = this.getResponseProperty("Enabled");
    const rawConfig = this.getResponseProperty("Config");
    this.config = rawConfig == null ? null : new configType(rawConfig);
  }
}
