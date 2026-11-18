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
 * Whether `value` names a risk category. Use it to validate values arriving from
 * outside the type system, such as a route parameter.
 */
export function isRiskCategory(value: unknown): value is RiskCategory {
  return Object.values<unknown>(RiskCategory).includes(value);
}
