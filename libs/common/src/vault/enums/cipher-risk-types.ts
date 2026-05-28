/**
 * Bitmask of password risks that triggered an alert exclusion. Combine values
 * with bitwise OR; test membership with bitwise AND. Mirrors the server-side
 * `Bit.Core.Vault.Enums.CipherRiskTypes` [Flags] enum.
 */
const _CipherRiskTypes = Object.freeze({
  None: 0,
  Weak: 1 << 0,
  Reused: 1 << 1,
  Exposed: 1 << 2,
} as const);

type _CipherRiskTypes = typeof _CipherRiskTypes;

export type CipherRiskTypes = _CipherRiskTypes[keyof _CipherRiskTypes];

// FIXME: Update typing of `CipherRiskTypes` to be `Record<keyof _CipherRiskTypes, CipherRiskTypes>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const CipherRiskTypes: typeof _CipherRiskTypes = _CipherRiskTypes;

export const hasRiskFlag = (mask: number, flag: CipherRiskTypes): boolean => (mask & flag) !== 0;
