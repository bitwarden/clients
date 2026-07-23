/**
 * The risk categories a login can fall into on the vault-health report.
 *
 * Uses a const object rather than a TypeScript enum per ADR-0025.
 */
export const RiskCategory = Object.freeze({
  Exposed: "exposed",
  Weak: "weak",
  Reused: "reused",
} as const);

export type RiskCategory = (typeof RiskCategory)[keyof typeof RiskCategory];

/**
 * Highest-risk-wins priority order for deduplicating a login into a single
 * category: Exposed beats Weak beats Reused (PM-39227 / PM-35945).
 */
export const RISK_CATEGORY_PRIORITY: readonly RiskCategory[] = [
  RiskCategory.Exposed,
  RiskCategory.Weak,
  RiskCategory.Reused,
] as const;
