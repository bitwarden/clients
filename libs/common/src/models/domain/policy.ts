import { PolicyType } from "../../enums/policyType";
import { Guid } from "../../types/guid";
import { PolicyData } from "../data/policy.data";

import Domain from "./domain-base";

export class Policy extends Domain {
  id: Guid;
  organizationId: Guid;
  type: PolicyType;
  data: any;
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
