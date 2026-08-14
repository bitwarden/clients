import { combineLatest, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { OrganizationUserPolicyContext } from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { getUserId } from "../../../auth/services/account.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { InternalNewPolicyService } from "../../abstractions/policy/new-policy.service";
import { PolicyService } from "../../abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Organization } from "../../models/domain/organization";
import { Policy } from "../../models/domain/policy";
import { ResetPasswordPolicyOptions } from "../../models/domain/reset-password-policy-options";

import { POLICIES } from "./policy-state";

export function policyRecordToArray(policiesMap: { [id: string]: PolicyData }): Policy[] {
  return Object.values(policiesMap || {}).map((f) => new Policy(f));
}

export const getFirstPolicy = map<Policy[], Policy | undefined>((policies) => {
  return policies.at(0) ?? undefined;
});

export class DefaultPolicyService implements PolicyService {
  constructor(
    private stateProvider: StateProvider,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private newPolicyService: InternalNewPolicyService,

    // This callback is used to avoid a circular dependency error.
    // PM-35986 addresses the root cause of the circular dependency.
    // The callback can be removed after that is merged.
    private sdkService: () => SdkService,
  ) {}

  private policyState(userId: UserId) {
    return this.stateProvider.getUser(userId, POLICIES);
  }

  private policyData$(userId: UserId) {
    return this.policyState(userId).state$.pipe(map((policyData) => policyData ?? {}));
  }

  policies$(userId: UserId) {
    return this.policyData$(userId).pipe(map((policyData) => policyRecordToArray(policyData)));
  }

  policiesByType$(policyType: PolicyType, userId: UserId): Observable<Policy[]> {
    if (!userId) {
      throw new Error("No userId provided");
    }

    // Uses the stateless SDK `client$` rather than `userClient$(userId)` because
    // this is invoked during login before the user client is initialized.
    // Safe for now because the policies crate is stateless, but will have to be
    // revisited if we want SDK-managed state in the future.

    return combineLatest([
      this.organizationService.organizations$(userId),
      this.organizationService.acceptedOrganizations$(userId),
      // Note: use newPolicyService state to include both accepted and confirmed policies
      this.newPolicyService.policies$(userId),
      this.sdkService().client$,
    ]).pipe(
      map(([confirmedOrganizations, acceptedOrganizations, policies, sdkClient]) => {
        const sdkPolicies = policies.map((p) => p.toSdkPolicyView());
        const sdkOrganizationContext = confirmedOrganizations
          .concat(acceptedOrganizations)
          .map((o) => DefaultPolicyService.toSdkOrganizationUserPolicyContext(o));
        const filteredViews = sdkClient
          .policies()
          .filter_by_type(sdkPolicies, sdkOrganizationContext, policyType);

        return filteredViews.map((v) => Policy.fromSdkPolicyView(v));
      }),
    );
  }

  policyAppliesToUser$(policyType: PolicyType, userId: UserId) {
    return this.policiesByType$(policyType, userId).pipe(
      getFirstPolicy,
      map((policy) => !!policy),
    );
  }

  masterPasswordPolicyOptions$(
    userId: UserId,
    policies?: Policy[],
  ): Observable<MasterPasswordPolicyOptions | undefined> {
    const policies$ = policies
      ? of(policies)
      : this.policiesByType$(PolicyType.MasterPassword, userId);
    return policies$.pipe(
      map((obsPolicies) => {
        // TODO ([PM-23777]): replace with this.combinePoliciesIntoMasterPasswordPolicyOptions(obsPolicies))
        let enforcedOptions: MasterPasswordPolicyOptions | undefined = undefined;
        const filteredPolicies =
          obsPolicies.filter((p) => p.type === PolicyType.MasterPassword) ?? [];

        if (filteredPolicies.length === 0) {
          return;
        }

        filteredPolicies.forEach((currentPolicy) => {
          if (!currentPolicy.enabled || !currentPolicy.data) {
            return;
          }

          if (!enforcedOptions) {
            enforcedOptions = new MasterPasswordPolicyOptions();
          }

          if (
            currentPolicy.data.minComplexity != null &&
            currentPolicy.data.minComplexity > enforcedOptions.minComplexity
          ) {
            enforcedOptions.minComplexity = currentPolicy.data.minComplexity;
          }

          if (
            currentPolicy.data.minLength != null &&
            currentPolicy.data.minLength > enforcedOptions.minLength
          ) {
            enforcedOptions.minLength = currentPolicy.data.minLength;
          }

          if (currentPolicy.data.requireUpper) {
            enforcedOptions.requireUpper = true;
          }

          if (currentPolicy.data.requireLower) {
            enforcedOptions.requireLower = true;
          }

          if (currentPolicy.data.requireNumbers) {
            enforcedOptions.requireNumbers = true;
          }

          if (currentPolicy.data.requireSpecial) {
            enforcedOptions.requireSpecial = true;
          }

          if (currentPolicy.data.enforceOnLogin) {
            enforcedOptions.enforceOnLogin = true;
          }
        });

        return enforcedOptions;
      }),
    );
  }

  combinePoliciesIntoMasterPasswordPolicyOptions(
    policies: Policy[],
  ): MasterPasswordPolicyOptions | undefined {
    let enforcedOptions: MasterPasswordPolicyOptions | undefined = undefined;
    const filteredPolicies = policies.filter((p) => p.type === PolicyType.MasterPassword) ?? [];

    if (filteredPolicies.length === 0) {
      return;
    }

    filteredPolicies.forEach((currentPolicy) => {
      if (!currentPolicy.enabled || !currentPolicy.data) {
        return undefined;
      }

      if (!enforcedOptions) {
        enforcedOptions = new MasterPasswordPolicyOptions();
      }

      this.mergeMasterPasswordPolicyOptions(enforcedOptions, currentPolicy.data);
    });

    return enforcedOptions;
  }

  combineMasterPasswordPolicyOptions(
    ...policies: MasterPasswordPolicyOptions[]
  ): MasterPasswordPolicyOptions | undefined {
    let combinedOptions: MasterPasswordPolicyOptions | undefined = undefined;

    policies.forEach((currentOptions) => {
      if (!combinedOptions) {
        combinedOptions = new MasterPasswordPolicyOptions();
      }

      this.mergeMasterPasswordPolicyOptions(combinedOptions, currentOptions);
    });

    return combinedOptions;
  }

  evaluateMasterPassword(
    passwordStrength: number,
    newPassword: string,
    enforcedPolicyOptions?: MasterPasswordPolicyOptions,
  ): boolean {
    if (!enforcedPolicyOptions) {
      return true;
    }

    if (
      enforcedPolicyOptions.minComplexity > 0 &&
      enforcedPolicyOptions.minComplexity > passwordStrength
    ) {
      return false;
    }

    if (
      enforcedPolicyOptions.minLength > 0 &&
      enforcedPolicyOptions.minLength > newPassword.length
    ) {
      return false;
    }

    if (enforcedPolicyOptions.requireUpper && newPassword.toLocaleLowerCase() === newPassword) {
      return false;
    }

    if (enforcedPolicyOptions.requireLower && newPassword.toLocaleUpperCase() === newPassword) {
      return false;
    }

    if (enforcedPolicyOptions.requireNumbers && !/[0-9]/.test(newPassword)) {
      return false;
    }

    // eslint-disable-next-line
    if (enforcedPolicyOptions.requireSpecial && !/[!@#$%\^&*]/g.test(newPassword)) {
      return false;
    }

    return true;
  }

  getResetPasswordPolicyOptions(
    policies: Policy[],
    orgId: string,
  ): [ResetPasswordPolicyOptions, boolean] {
    const resetPasswordPolicyOptions = new ResetPasswordPolicyOptions();

    if (!policies || !orgId) {
      return [resetPasswordPolicyOptions, false];
    }

    const policy = policies.find(
      (p) => p.organizationId === orgId && p.type === PolicyType.ResetPassword && p.enabled,
    );
    resetPasswordPolicyOptions.autoEnrollEnabled = policy?.data?.autoEnrollEnabled ?? false;

    return [resetPasswordPolicyOptions, policy?.enabled ?? false];
  }

  async upsert(policy: PolicyData, userId: UserId): Promise<void> {
    await this.policyState(userId).update((policies) => {
      policies ??= {};
      policies[policy.id] = policy;
      return policies;
    });
  }

  async replace(policies: { [id: string]: PolicyData }, userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(POLICIES, policies, userId);
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

  private mergeMasterPasswordPolicyOptions(
    target: MasterPasswordPolicyOptions | undefined,
    source: MasterPasswordPolicyOptions | undefined,
  ) {
    if (!target) {
      target = new MasterPasswordPolicyOptions();
    }

    // For complexity and minLength, take the highest value.
    // For boolean settings, enable it if either policy has it enabled (OR).
    if (source) {
      target.minComplexity = Math.max(
        target.minComplexity,
        source.minComplexity ?? target.minComplexity,
      );
      target.minLength = Math.max(target.minLength, source.minLength ?? target.minLength);
      target.requireUpper = Boolean(target.requireUpper || source.requireUpper);
      target.requireLower = Boolean(target.requireLower || source.requireLower);
      target.requireNumbers = Boolean(target.requireNumbers || source.requireNumbers);
      target.requireSpecial = Boolean(target.requireSpecial || source.requireSpecial);
      target.enforceOnLogin = Boolean(target.enforceOnLogin || source.enforceOnLogin);
    }
  }

  async syncPolicy(policyData: PolicyData) {
    await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.upsert(policyData, userId)),
      ),
    );
  }
}
