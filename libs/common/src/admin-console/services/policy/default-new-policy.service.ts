import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service.abstraction";
import { PolicyData } from "../../models/data/policy.data";

import { POLICIES_NEW } from "./policy-state";

export class DefaultNewPolicyService implements InternalNewPolicyService {
  constructor(private stateProvider: StateProvider) {}

  private policyState(userId: UserId) {
    return this.stateProvider.getUser(userId, POLICIES_NEW);
  }

  async upsert(policy: PolicyData, userId: UserId): Promise<void> {
    await this.policyState(userId).update((policies) => {
      policies ??= {};
      policies[policy.id] = policy;
      return policies;
    });
  }

  async replace(policies: { [id: string]: PolicyData }, userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(POLICIES_NEW, policies, userId);
  }
}
