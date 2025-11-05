import { combineLatest, map, Observable, of } from "rxjs";

import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { PolicyService } from "../../abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType, PolicyType } from "../../enums";
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

  policiesByType$(policyType: PolicyType, userId: UserId) {
    if (!userId) {
      throw new Error("No userId provided");
    }

    const allPolicies$ = this.policies$(userId);
    const organizations$ = this.organizationService.organizations$(userId);

    return combineLatest([allPolicies$, organizations$]).pipe(
      map(([policies, organizations]) => this.enforcedPolicyFilter(policies, organizations)),
      map((policies) => policies.filter((p) => p.type === policyType)),
    );
  }

  policyAppliesToUser$(policyType: PolicyType, userId: UserId) {
    return this.policiesByType$(policyType, userId).pipe(
      getFirstPolicy,
      map((policy) => !!policy),
    );
  }

  private enforcedPolicyFilter(policies: Policy[], organizations: Organization[]) {
    const orgDict = Object.fromEntries(organizations.map((o) => [o.id, o]));
    return policies.filter((policy) => {
      const organization = orgDict[policy.organizationId];

      // This shouldn't happen, i.e. the user should only have policies for orgs they are a member of
      // But if it does, err on the side of enforcing the policy
      if (!organization) {
        return true;
      }

      return (
        policy.enabled &&
        organization.status >= OrganizationUserStatusType.Accepted &&
        organization.usePolicies &&
        !this.isExemptFromPolicy(policy.type, organization, policies)
      );
    });
  }

  masterPasswordPolicyOptions$(
    userId: UserId,
    policies?: Policy[],
  ): Observable<MasterPasswordPolicyOptions | undefined> {
    const policies$ = policies ? of(policies) : this.policies$(userId);
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
   * Determines whether an orgUser is exempt from a specific policy because of their role
   * Generally orgUsers who can manage policies are exempt from them, but some policies are stricter
   */
  private isExemptFromPolicy(
    policyType: PolicyType,
    organization: Organization,
    allPolicies: Policy[],
  ) {
    switch (policyType) {
      case PolicyType.MaximumVaultTimeout:
        // Max Vault Timeout applies to everyone except owners
        return organization.isOwner;
      // the following policies apply to everyone
      case PolicyType.PasswordGenerator:
        // password generation policy
        return false;
      case PolicyType.FreeFamiliesSponsorshipPolicy:
        // free Bitwarden families policy
        return false;
      case PolicyType.RestrictedItemTypes:
        // restricted item types policy
        return false;
      case PolicyType.RemoveUnlockWithPin:
        // Remove Unlock with PIN policy
        return false;
      case PolicyType.OrganizationDataOwnership:
        // organization data ownership policy applies to everyone except admins and owners
        return organization.isAdmin;
      case PolicyType.SingleOrg:
        // Check if AutoConfirm policy is enabled for this organization
        return allPolicies.find(
          (p) =>
            p.organizationId === organization.id && p.type === PolicyType.AutoConfirm && p.enabled,
        )
          ? false
          : organization.canManagePolicies;
      default:
        return organization.canManagePolicies;
    }
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
}
