import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { GrantedProjectAccessPolicyPermissionDetailsResponse } from "./service-account-project-policy-permission-details.response";

export class ServiceAccountGrantedPoliciesPermissionDetailsResponse extends BaseResponse {
  grantedProjectPolicies: GrantedProjectAccessPolicyPermissionDetailsResponse[];

  constructor(response: any) {
    super(response);
    const grantedProjectPolicies = this.getResponseProperty("GrantedProjectPolicies");
    this.grantedProjectPolicies = grantedProjectPolicies.map(
      (k: any) => new GrantedProjectAccessPolicyPermissionDetailsResponse(k),
    );
  }
}
