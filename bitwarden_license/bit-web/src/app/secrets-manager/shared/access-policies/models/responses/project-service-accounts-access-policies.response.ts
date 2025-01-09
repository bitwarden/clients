import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { ServiceAccountAccessPolicyResponse } from "./access-policy.response";

export class ProjectServiceAccountsAccessPoliciesResponse extends BaseResponse {
  serviceAccountAccessPolicies: ServiceAccountAccessPolicyResponse[];

  constructor(response: any) {
    super(response);
    const serviceAccountAccessPolicies = this.getResponseProperty("ServiceAccountAccessPolicies");
    this.serviceAccountAccessPolicies = serviceAccountAccessPolicies.map(
      (k: any) => new ServiceAccountAccessPolicyResponse(k),
    );
  }
}
