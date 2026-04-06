import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationResponse implements BaseResponse {
  object: string;
  id: string;
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
