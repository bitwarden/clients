import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { GroupAccessPolicyResponse, UserAccessPolicyResponse } from "./access-policy.response";

export class ServiceAccountPeopleAccessPoliciesResponse extends BaseResponse {
  userAccessPolicies: UserAccessPolicyResponse[];
  groupAccessPolicies: GroupAccessPolicyResponse[];

  constructor(response: any) {
    super(response);
    const userAccessPolicies = this.getResponseProperty("UserAccessPolicies");
    this.userAccessPolicies = userAccessPolicies.map((k: any) => new UserAccessPolicyResponse(k));
    const groupAccessPolicies = this.getResponseProperty("GroupAccessPolicies");
    this.groupAccessPolicies = groupAccessPolicies.map(
      (k: any) => new GroupAccessPolicyResponse(k),
    );
  }
}
