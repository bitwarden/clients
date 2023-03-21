import { OrganizationUserStatusType } from "@bitwarden/common/enums/organizationUserStatusType";
import { OrganizationUserType } from "@bitwarden/common/enums/organizationUserType";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { Guid } from "@bitwarden/common/types/guid";

import { BaseResponse } from "./base.response";

export class OrganizationResponse implements BaseResponse {
  object: string;
  id: Guid;
  name: string;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  enabled: boolean;

  constructor(o: Organization) {
    this.object = "organization";
    this.id = o.id;
    this.name = o.name;
    this.status = o.status;
    this.type = o.type;
    this.enabled = o.enabled;
  }
}
