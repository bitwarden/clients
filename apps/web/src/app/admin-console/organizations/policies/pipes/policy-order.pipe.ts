import { Pipe, PipeTransform } from "@angular/core";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";

/**
 * Order mapping for policies. Policies are ordered according to this mapping.
 * Policies not in this mapping will appear at the end, maintaining their relative order.
 */
const POLICY_ORDER_MAP = new Map<string, number>([
  ["singleOrg", 1],
  ["organizationDataOwnership", 2],
  ["centralizeDataOwnership", 2],
  ["masterPassPolicyTitle", 3],
  ["accountRecoveryPolicy", 4],
  ["requireSso", 5],
  ["automaticAppLoginWithSSO", 6],
  ["twoStepLoginPolicyTitle", 7],
  ["blockClaimedDomainAccountCreation", 8],
  ["sessionTimeoutPolicyTitle", 9],
  ["removeUnlockWithPinPolicyTitle", 10],
  ["passwordGenerator", 11],
  ["uriMatchDetectionPolicy", 12],
  ["activateAutofill", 13],
  ["sendOptions", 14],
  ["disableSend", 15],
  ["restrictedItemTypePolicy", 16],
  ["freeFamiliesSponsorship", 17],
  ["disableExport", 18],
]);

/**
 * Default order for policies not in the mapping. This ensures unmapped policies
 * appear at the end while maintaining their relative order.
 */
const DEFAULT_ORDER = 999;

@Pipe({
  name: "policyOrder",
  standalone: true,
})
export class PolicyOrderPipe implements PipeTransform {
  transform(
    policies: readonly BasePolicyEditDefinition[] | null | undefined,
  ): BasePolicyEditDefinition[] {
    if (policies == null || policies.length === 0) {
      return [];
    }

    const sortedPolicies = [...policies];

    sortedPolicies.sort((a, b) => {
      const orderA = POLICY_ORDER_MAP.get(a.name) ?? DEFAULT_ORDER;
      const orderB = POLICY_ORDER_MAP.get(b.name) ?? DEFAULT_ORDER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const indexA = policies.indexOf(a);
      const indexB = policies.indexOf(b);
      return indexA - indexB;
    });

    return sortedPolicies;
  }
}
