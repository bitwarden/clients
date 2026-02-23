import { Pipe, PipeTransform } from "@angular/core";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";

export const PolicyCategory = {
  DataControl: "data-controls",
  Authentication: "authentication",
  VaultManagement: "vault-management",
} as const;

export type PolicyCategory = (typeof PolicyCategory)[keyof typeof PolicyCategory];

/**
 * Category mapping for policies. Policies are grouped according to this mapping.
 * Policies not in this mapping fall back to VaultManagement.
 */
export const POLICY_CATEGORY_MAP = new Map<string, PolicyCategory>([
  // Data controls
  ["singleOrg", PolicyCategory.DataControl],
  ["organizationDataOwnership", PolicyCategory.DataControl],
  ["centralizeDataOwnership", PolicyCategory.DataControl],
  ["disableSend", PolicyCategory.DataControl],
  ["sendOptions", PolicyCategory.DataControl],
  ["disableExport", PolicyCategory.DataControl],

  // Authentication
  ["masterPassPolicyTitle", PolicyCategory.Authentication],
  ["accountRecoveryPolicy", PolicyCategory.Authentication],
  ["requireSso", PolicyCategory.Authentication],
  ["twoStepLoginPolicyTitle", PolicyCategory.Authentication],
  ["blockClaimedDomainAccountCreation", PolicyCategory.Authentication],
  ["sessionTimeoutPolicyTitle", PolicyCategory.Authentication],
  ["removeUnlockWithPinPolicyTitle", PolicyCategory.Authentication],

  // Vault management
  ["passwordGenerator", PolicyCategory.VaultManagement],
  ["uriMatchDetectionPolicy", PolicyCategory.VaultManagement],
  ["automaticAppLoginWithSSO", PolicyCategory.VaultManagement],
  ["activateAutofillPolicy", PolicyCategory.VaultManagement],
  ["restrictedItemTypePolicy", PolicyCategory.VaultManagement],
  ["freeFamiliesSponsorship", PolicyCategory.VaultManagement],
  ["desktopAutotypePolicy", PolicyCategory.VaultManagement],
  ["autoConfirm", PolicyCategory.VaultManagement],
]);

@Pipe({
  name: "policyCategory",
  standalone: true,
})
export class PolicyCategoryPipe implements PipeTransform {
  transform(
    policies: readonly BasePolicyEditDefinition[] | null | undefined,
    category: PolicyCategory,
  ): BasePolicyEditDefinition[] {
    if (policies == null || policies.length === 0) {
      return [];
    }

    return policies.filter(
      (p) => (POLICY_CATEGORY_MAP.get(p.name) ?? PolicyCategory.VaultManagement) === category,
    );
  }
}
