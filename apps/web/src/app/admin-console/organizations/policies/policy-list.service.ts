import { BasePolicy } from "./base-policy.component";

export class PolicyListService {
  private policies: readonly BasePolicy[];

  constructor(policies: BasePolicy[]) {
    this.policies = Object.freeze([...policies]);
  }

  getPolicies() {
    return this.policies;
  }
}
