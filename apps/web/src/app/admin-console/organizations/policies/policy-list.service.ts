import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyCategory } from "./pipes/policy-category.pipe";

export interface PolicySection {
  category: PolicyCategory;
  labelKey: string;
  policies: readonly BasePolicyEditDefinition[];
}

const SECTION_DEFS: readonly { category: PolicyCategory; labelKey: string }[] = [
  { category: PolicyCategory.DataControl, labelKey: "dataControls" },
  { category: PolicyCategory.Authentication, labelKey: "authentication" },
  { category: PolicyCategory.VaultManagement, labelKey: "vaultManagement" },
];

export class PolicyListService {
  private readonly allPolicies: readonly BasePolicyEditDefinition[];
  readonly sections: readonly PolicySection[];

  constructor(policies: BasePolicyEditDefinition[]) {
    const sorted = [...policies].sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : policies.indexOf(a) - policies.indexOf(b),
    );

    this.allPolicies = Object.freeze(sorted);
    this.sections = SECTION_DEFS.map((def) => ({
      ...def,
      policies: sorted.filter((p) => p.category === def.category),
    }));
  }

  getPolicies(): readonly BasePolicyEditDefinition[] {
    return this.allPolicies;
  }
}
