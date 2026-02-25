import { Pipe, PipeTransform } from "@angular/core";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";

export const PolicyCategory = {
  DataControl: "data-controls",
  Authentication: "authentication",
  VaultManagement: "vault-management",
} as const;

export type PolicyCategory = (typeof PolicyCategory)[keyof typeof PolicyCategory];

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

    return policies.filter((p) => p.category === category);
  }
}
