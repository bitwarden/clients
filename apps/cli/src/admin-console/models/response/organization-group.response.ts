import { GroupResponse } from "@bitwarden/admin-console/common";

import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationGroupResponse implements BaseResponse {
  object: string;
  id: string;
  organizationId: string;
  name: string;
  externalId: string;

  constructor(response: GroupResponse) {
    this.object = "org-group";
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.name = response.name;
    this.externalId = response.externalId;
  }
}
