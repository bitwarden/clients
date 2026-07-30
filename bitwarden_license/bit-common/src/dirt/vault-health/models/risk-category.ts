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
