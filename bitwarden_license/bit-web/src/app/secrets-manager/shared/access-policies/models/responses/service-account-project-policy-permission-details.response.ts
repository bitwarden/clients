import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { GrantedProjectAccessPolicyResponse } from "./access-policy.response";

export class GrantedProjectAccessPolicyPermissionDetailsResponse extends BaseResponse {
  accessPolicy: GrantedProjectAccessPolicyResponse;
  hasPermission: boolean;

  constructor(response: any) {
    super(response);
    this.accessPolicy = this.getResponseProperty("AccessPolicy");
    this.hasPermission = this.getResponseProperty("HasPermission");
  }
}
