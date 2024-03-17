import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyResponse } from "../response/policy.response";

export class PolicyData {
  id: PolicyId;
  organizationId: string;
  type: PolicyType;
  data: Record<string, string | number | boolean>;
  enabled: boolean;

  constructor(response?: PolicyResponse) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.organizationId = response.organizationId;
    this.type = response.type;
    this.data = response.data;
    this.enabled = response.enabled;
  }
}
