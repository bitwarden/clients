import { Observable } from "rxjs";

import type {
  CipherRiskResult,
  CipherRiskOptions,
  PasswordReuseMap,
} from "@bitwarden/sdk-internal";

import { UserId, CipherId } from "../../types/guid";
import { CipherView } from "../models/view/cipher.view";

/**
 * SDK password_strength is a 0–4 zxcvbn score; anything below this is treated as weak.
 */
export const WEAK_PASSWORD_STRENGTH_THRESHOLD = 3;

export type CipherRiskCounts = {
  exposedBreaches: number;
  reuseCount: number;
  weak: boolean;
};

export type PersonalVaultRiskSummary = {
  exposed: CipherView[];
  weak: CipherView[];
  reused: CipherView[];
  riskCounts: ReadonlyMap<CipherId, CipherRiskCounts>;
  scannedAt: Date;
};

export type RiskScanPhase = "preparing" | "analyzing" | "checkingBreaches";

export type PersonalVaultRiskProgress = {
  type: "progress";
  phase: RiskScanPhase;
  processed: number;
  total: number;
  /** 0–100 */
  percent: number;
};

export type PersonalVaultRiskUpdate =
  | PersonalVaultRiskProgress
  | { type: "result"; summary: PersonalVaultRiskSummary };

export abstract class CipherRiskService {
  /**
   * Compute password risks for multiple ciphers.
   * Only processes Login ciphers with passwords.
   *
   * @param ciphers - The ciphers to evaluate for password risks
   * @param userId - The user ID for SDK client context
   * @param options - Optional configuration for risk computation (passwordMap, checkExposed)
   * @returns Array of CipherRisk results from SDK containing password_strength, exposed_result, and reuse_count
   */
  abstract computeRiskForCiphers(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRiskResult[]>;

  /**
   * Compute password risk for a single cipher by its ID. Will automatically build a password reuse map
   * from all the user's ciphers via the CipherService.
   * @param cipherId
   * @param userId
   * @param checkExposed - Whether to check if the password has been exposed in data breaches via HIBP
   * @returns CipherRisk result from SDK containing password_strength, exposed_result, and reuse_count
   */
  abstract computeCipherRiskForUser(
    cipherId: CipherId,
    userId: UserId,
    checkExposed?: boolean,
  ): Promise<CipherRiskResult>;

  /**
   * Build a password reuse map for the given ciphers.
   * Maps each password to the number of times it appears across ciphers.
   * Only processes Login ciphers with passwords.
   *
   * @param ciphers - The ciphers to analyze for password reuse
   * @param userId - The user ID for SDK client context
   * @returns A map of password to count of occurrences
   */
  abstract buildPasswordReuseMap(ciphers: CipherView[], userId: UserId): Promise<PasswordReuseMap>;

  /**
   * Scan all personal vault login ciphers and return a summary of exposed, weak, and reused passwords.
   * Exposed check uses HIBP via AuditService with a max 5-concurrent request cap.
   *
   * The returned observable emits one or more `progress` events as the scan walks through its
   * phases ("preparing", "analyzing", "checkingBreaches"), then emits a single `result` event with
   * the final summary and completes.
   *
   * @param userId - The user ID whose personal vault to scan
   * @param options - Optional SDK risk options (passwordMap is built automatically)
   */
  abstract computeRiskForPersonalVault(
    userId: UserId,
    options?: Omit<CipherRiskOptions, "checkExposed">,
  ): Observable<PersonalVaultRiskUpdate>;
}

/**
 * Evaluates if a password represented by a CipherRiskResult is considered at risk.
 *
 * A password is considered at risk if any of the following conditions are true:
 * - The password has been exposed in data breaches
 * - The password is reused across multiple ciphers
 * - The password has weak strength (password_strength < WEAK_PASSWORD_STRENGTH_THRESHOLD)
 *
 * @param risk - The CipherRiskResult to evaluate
 * @returns true if the password is at risk, false otherwise
 */
export function isPasswordAtRisk(risk: CipherRiskResult): boolean {
  return (
    (risk.exposed_result.type === "Found" && risk.exposed_result.value > 0) ||
    (risk.reuse_count ?? 1) > 1 ||
    risk.password_strength < WEAK_PASSWORD_STRENGTH_THRESHOLD
  );
}
