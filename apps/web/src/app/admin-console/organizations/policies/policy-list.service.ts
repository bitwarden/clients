import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyCategory } from "./pipes/policy-category";

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

  /**
   * All policies grouped by category and sorted by priority within each category.
   * Sections with no registered policies are included but will have an empty policies array.
   */
  readonly sections: readonly PolicySection[];

  /**
   * @param policies The full list of registered policy definitions to manage.
   *   Policies are sorted by {@link BasePolicyEditDefinition.priority} ascending,
   *   with registration order used as a tiebreaker.
   */
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

  /**
   * Returns all registered policy definitions sorted by priority ascending.
   */
  getPolicies(): readonly BasePolicyEditDefinition[] {
    return this.allPolicies;
  }
}
