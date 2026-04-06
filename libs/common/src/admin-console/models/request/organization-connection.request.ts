import { BillingSyncConfigRequest } from "../../../billing/models/request/billing-sync-config.request";
import { OrganizationConnectionType } from "../../enums";

import { ScimConfigRequest } from "./scim-config.request";

/**API request config types for OrganizationConnectionRequest */
export type OrganizationConnectionRequestConfigs = BillingSyncConfigRequest | ScimConfigRequest;

export class OrganizationConnectionRequest {
  constructor(
    public organizationId: string,
    public type: OrganizationConnectionType,
    public enabled: boolean,
    public config: OrganizationConnectionRequestConfigs,
  ) {}
}
