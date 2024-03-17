import Domain from "../../../platform/models/domain/domain-base";
import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../data/policy.data";

export class Policy extends Domain {
  id: PolicyId;
  organizationId: string;
  type: PolicyType;
  data: any;

  /**
   * Warning: a user can be exempt from a policy even if the policy is enabled.
   * @see {@link PolicyService} has methods to tell you whether a policy applies to a user.
   */
  enabled: boolean;

  constructor(obj?: PolicyData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.organizationId = obj.organizationId;
    this.type = obj.type;
    this.data = obj.data;
    this.enabled = obj.enabled;
  }
}
