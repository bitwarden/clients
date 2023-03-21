import { OrganizationConnectionType } from "../../enums/organizationConnectionType";
import { Guid } from "../../types/guid";

import { BillingSyncConfigRequest } from "./billing-sync-config.request";
import { ScimConfigRequest } from "./scim-config.request";

/**API request config types for OrganizationConnectionRequest */
export type OrganizationConnectionRequestConfigs = BillingSyncConfigRequest | ScimConfigRequest;

export class OrganizationConnectionRequest {
  constructor(
    public organizationId: Guid,
    public type: OrganizationConnectionType,
    public enabled: boolean,
    public config: OrganizationConnectionRequestConfigs
  ) {}
}
