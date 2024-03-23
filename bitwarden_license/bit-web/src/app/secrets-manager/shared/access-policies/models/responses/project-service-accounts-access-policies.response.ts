import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { ServiceAccountProjectAccessPolicyResponse } from "./access-policy.response";

export class ProjectServiceAccountsAccessPoliciesResponse extends BaseResponse {
  serviceAccountAccessPolicies: ServiceAccountProjectAccessPolicyResponse[];

  constructor(response: any) {
    super(response);

    const serviceAccountsAccessPolicies = this.getResponseProperty("ServiceAccountsAccessPolicies");
    this.serviceAccountAccessPolicies = serviceAccountsAccessPolicies.map(
      (k: any) => new ServiceAccountProjectAccessPolicyResponse(k),
    );
  }
}
