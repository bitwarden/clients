import { BasePolicyEditDefinition } from "./base-policy-edit.component";

export class PolicyListService {
  private policies: readonly BasePolicyEditDefinition[];

  constructor(policies: BasePolicyEditDefinition[]) {
    this.policies = Object.freeze([...policies]);
  }

  getPolicies() {
    return this.policies;
  }
}
