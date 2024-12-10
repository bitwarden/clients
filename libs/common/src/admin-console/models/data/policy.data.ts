// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { Policy } from "../domain/policy";
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

  static fromPolicy(policy: Policy): PolicyData {
    return Object.assign(new PolicyData(), policy);
  }
}
