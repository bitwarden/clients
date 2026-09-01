import { combineLatest, map, Observable } from "rxjs";

import { OrganizationUserPolicyContext } from "@bitwarden/sdk-internal";

import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service.abstraction";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { Organization } from "../../models/domain/organization";
import { Policy } from "../../models/domain/policy";

import { POLICIES_NEW } from "./policy-state";

export class DefaultNewPolicyService implements InternalNewPolicyService {
  constructor(
    private stateProvider: StateProvider,
    // This callback is used to avoid a circular dependency error.
    // PM-35986 addresses the root cause of the circular dependency.
    // The callback can be removed after that is merged.
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
        const sdkOrganizationContext = confirmedOrganizations
          .concat(acceptedOrganizations)
          .map((o) => DefaultNewPolicyService.toSdkOrganizationUserPolicyContext(o));
        const filteredViews = sdkClient
          .policies()
          .filter_by_type(sdkPolicies, sdkOrganizationContext, policyType);

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

  /**
   * Converts organization sync data to the SDK context model.
   * This belongs in this service because it is specific to the policy domain.
   */
  private static toSdkOrganizationUserPolicyContext(
    organization: Organization,
  ): OrganizationUserPolicyContext {
    return {
      id: organization.id,
      status: organization.status,
      role: organization.type,
      enabled: organization.enabled,
      usePolicies: organization.usePolicies,
      isProviderUser: organization.isProviderUser,
    };
  }
}
