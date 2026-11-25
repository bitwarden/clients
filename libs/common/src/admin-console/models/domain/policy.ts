import { Policy as SdkPolicy } from "@bitwarden/sdk-internal";

import { ListResponse } from "../../../models/response/list.response";
import Domain from "../../../platform/models/domain/domain-base";
import { OrganizationId, PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../data/policy.data";
import { PolicyResponse } from "../response/policy.response";

import { PolicyRecordMapper } from "./policy-sdk-mapper";

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

  constructor(obj: PolicyData) {
    super();

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

  static fromSdkPolicy(obj: SdkPolicy): Policy {
    return new Policy(new PolicyRecordMapper().fromSdk(obj));
  }

  toPolicyData(): PolicyData {
    return {
      id: this.id,
      organizationId: this.organizationId,
      type: this.type,
      data: this.data,
      enabled: this.enabled,
      revisionDate: this.revisionDate.toISOString(),
    };
  }
}
