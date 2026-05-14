import { combineLatest, map, Observable } from "rxjs";

import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service.abstraction";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { Policy } from "../../models/domain/policy";

import { POLICIES_NEW } from "./policy-state";

export class DefaultNewPolicyService implements InternalNewPolicyService {
  constructor(
    private stateProvider: StateProvider,
    private sdkService: () => SdkService,
    private organizationService: OrganizationService,
  ) {}

  policiesByType$(policyType: PolicyType, userId: UserId): Observable<Policy[]> {
    // Uses the stateless SDK `client$` rather than `userClient$(userId)` because
    // this is invoked during login before the user client is initialized.
    // Safe for now because the policies crate is stateless, but will have to be
    // revisited if we want SDK-managed state in the future.

    return combineLatest([
      this.organizationService.organizations$(userId),
      this.organizationService.acceptedOrganizations$(userId),
      this.policies$(userId),
      this.sdkService().client$,
    ]).pipe(
      map(([confirmedOrganizations, acceptedOrganizations, policies, sdkClient]) => {
        if (!sdkClient) {
          throw new Error("SDK not available");
        }

        const sdkPolicies = policies.map((p) => p.toSdkPolicyView());
        const sdkOrgs = confirmedOrganizations
          .concat(acceptedOrganizations)
          .map((o) => o.toSdkProfileOrganization());
        const filteredViews = sdkClient.policies().filter_by_type(sdkPolicies, sdkOrgs, policyType);

        const result = filteredViews.map((v) => Policy.fromSdkPolicyView(v));

        return result;
      }),
    );
  }

  private policies$(userId: UserId) {
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
