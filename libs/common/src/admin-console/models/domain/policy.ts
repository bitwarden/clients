// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyView as SdkPolicyView } from "@bitwarden/sdk-internal";

import { ListResponse } from "../../../models/response/list.response";
import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import Domain from "../../../platform/models/domain/domain-base";
import { OrganizationId, PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../data/policy.data";
import { PolicyResponse } from "../response/policy.response";

export class Policy extends Domain {
  id: PolicyId;
  organizationId: OrganizationId;
  type: PolicyType;
  data: any;

  /**
   * Warning: a user can be exempt from a policy even if the policy is enabled.
   * @see {@link PolicyService} has methods to tell you whether a policy applies to a user.
   */
  enabled: boolean;

  revisionDate: Date;

  constructor(obj?: PolicyData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.organizationId = obj.organizationId as OrganizationId;
    this.type = obj.type;
    this.data = obj.data;
    this.enabled = obj.enabled;
    this.revisionDate = new Date(obj.revisionDate);
  }

  static fromResponse(response: PolicyResponse): Policy {
    return new Policy(new PolicyData(response));
  }

  static fromListResponse(response: ListResponse<PolicyResponse>): Policy[] {
    return response.data.map((d) => Policy.fromResponse(d));
  }

  static fromSdkPolicyView(obj: SdkPolicyView): Policy {
    const policy = new Policy();
    policy.id = uuidAsString(obj.id) as PolicyId;
    policy.organizationId = uuidAsString(obj.organizationId) as OrganizationId;
    policy.type = obj.type;
    policy.data = obj.data == null ? null : JSON.parse(obj.data);
    policy.enabled = obj.enabled;
    policy.revisionDate = obj.revisionDate == null ? undefined : new Date(obj.revisionDate);
    return policy;
  }

  toSdkPolicyView(): SdkPolicyView {
    return {
      id: asUuid(this.id),
      organizationId: asUuid(this.organizationId),
      type: this.type,
      data: this.data == null ? undefined : JSON.stringify(this.data),
      enabled: this.enabled,
      revisionDate: this.revisionDate == null ? undefined : this.revisionDate.toISOString(),
    };
  }
}
