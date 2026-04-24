import { combineLatest, map } from "rxjs";

import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service.abstraction";
import { OrganizationUserStatusType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";

import { policyRecordToArray } from "./default-policy.service";
import { POLICIES_NEW } from "./policy-state";

export class DefaultNewPolicyService implements InternalNewPolicyService {
  constructor(
    private stateProvider: StateProvider,
    private organizationService: OrganizationService,
  ) {}

  private policyState(userId: UserId) {
    return this.stateProvider.getUser(userId, POLICIES_NEW);
  }

  private policyData$(userId: UserId) {
    return this.policyState(userId).state$.pipe(map((policyData) => policyData ?? {}));
  }

  acceptedPolicies$(userId: UserId) {
    return combineLatest([
      this.policyData$(userId).pipe(map((d) => policyRecordToArray(d))),
      this.organizationService.organizations$(userId),
    ]).pipe(
      map(([policies, organizations]) => {
        const orgDict = Object.fromEntries(organizations.map((o) => [o.id, o]));
        return policies.filter(
          (policy) =>
            orgDict[policy.organizationId]?.status === OrganizationUserStatusType.Accepted,
        );
      }),
    );
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
