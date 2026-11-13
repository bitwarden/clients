import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import {
  GroupAccessPolicyResponse,
  UserAccessPolicyResponse,
  ServiceAccountAccessPolicyResponse,
} from "./access-policy.response";

export class SecretAccessPoliciesResponse extends BaseResponse {
  userAccessPolicies: UserAccessPolicyResponse[];
  groupAccessPolicies: GroupAccessPolicyResponse[];
  serviceAccountAccessPolicies: ServiceAccountAccessPolicyResponse[];

  constructor(response: any) {
    super(response);
    const userAccessPolicies = this.getResponseProperty("UserAccessPolicies");
    this.userAccessPolicies = userAccessPolicies.map((k: any) => new UserAccessPolicyResponse(k));
    const groupAccessPolicies = this.getResponseProperty("GroupAccessPolicies");
    this.groupAccessPolicies = groupAccessPolicies.map(
      (k: any) => new GroupAccessPolicyResponse(k),
    );
    const serviceAccountAccessPolicies = this.getResponseProperty("ServiceAccountAccessPolicies");
    this.serviceAccountAccessPolicies = serviceAccountAccessPolicies.map(
      (k: any) => new ServiceAccountAccessPolicyResponse(k),
    );
  }
}
