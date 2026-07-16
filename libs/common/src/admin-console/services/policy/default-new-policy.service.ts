import { map, Observable } from "rxjs";

import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service";
import { PolicyData } from "../../models/data/policy.data";
import { Policy } from "../../models/domain/policy";

import { POLICIES_NEW } from "./policy-state";

export class DefaultNewPolicyService implements InternalNewPolicyService {
  constructor(private stateProvider: StateProvider) {}

  policies$(userId: UserId): Observable<Policy[]> {
    return this.policyState(userId).state$.pipe(
      map((policiesMap) => Object.values(policiesMap || {}).map((f) => new Policy(f))),
    );
  }

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
