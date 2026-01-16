import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Status of a risk insights item (per ADR-0025 - no enums)
 */
export const RiskInsightsItemStatus = Object.freeze({
  Healthy: "healthy",
  AtRisk: "at-risk",
} as const);
export type RiskInsightsItemStatus =
  (typeof RiskInsightsItemStatus)[keyof typeof RiskInsightsItemStatus];

/**
 * Processing phase for the risk insights prototype (per ADR-0025 - no enums)
 */
export const ProcessingPhase = Object.freeze({
  Idle: "idle",
  LoadingCiphers: "loading-ciphers",
  RunningHealthChecks: "running-health-checks",
  LoadingMembers: "loading-members",
  RunningHibp: "running-hibp",
  Complete: "complete",
  Error: "error",
} as const);
export type ProcessingPhase = (typeof ProcessingPhase)[keyof typeof ProcessingPhase];

/**
 * Progress information for tracking operation completion
 */
export interface ProgressInfo {
  /** Number of items processed so far */
  current: number;
  /** Total number of items to process */
  total: number;
  /** Progress percentage (0-100) */
  percent: number;
}

/**
 * Represents a single item in the risk insights report
 */
export interface RiskInsightsItem {
  /** Unique identifier for the cipher */
  cipherId: string;
  /** Display name of the cipher */
  cipherName: string;
  /** Subtitle for the cipher (typically username) */
  cipherSubtitle: string;

  // Health status columns - null means not checked or pending
  /** Whether the cipher has a weak password (null = not checked) */
  weakPassword: boolean | null;
  /** Whether the cipher has a reused password (null = not checked) */
  reusedPassword: boolean | null;
  /** Whether the cipher has an exposed password (null = not checked or pending) */
  exposedPassword: boolean | null;
  /** Number of times the password was exposed in breaches */
  exposedCount: number | null;

  // Member data
  /** Number of members with access to this cipher (null = pending) */
  memberCount: number | null;
  /** Whether member access data is still being loaded */
  memberAccessPending: boolean;

  // Computed status
  /** Overall risk status (null = still calculating) */
  status: RiskInsightsItemStatus | null;

  // Reference to full cipher for detail view
  /** The underlying cipher view object */
  cipher: CipherView;
}

/**
 * Creates an initial RiskInsightsItem from a cipher with placeholder values
 */
export function createRiskInsightsItem(cipher: CipherView): RiskInsightsItem {
  return {
    cipherId: cipher.id,
    cipherName: cipher.name || "(no name)",
    cipherSubtitle: cipher.login?.username || "",
    weakPassword: null,
    reusedPassword: null,
    exposedPassword: null,
    exposedCount: null,
    memberCount: null,
    memberAccessPending: true,
    status: null,
    cipher,
  };
}

/**
 * Calculates the at-risk status based on password health flags
 * @param weakPassword Whether the password is weak
 * @param reusedPassword Whether the password is reused
 * @param exposedPassword Whether the password is exposed
 * @returns The risk status, or null if any required check is still pending
 */
export function calculateRiskStatus(
  weakPassword: boolean | null,
  reusedPassword: boolean | null,
  exposedPassword: boolean | null,
  enableWeakCheck: boolean,
  enableReusedCheck: boolean,
  enableHibpCheck: boolean,
): RiskInsightsItemStatus | null {
  // If no checks are enabled, status is healthy
  if (!enableWeakCheck && !enableReusedCheck && !enableHibpCheck) {
    return RiskInsightsItemStatus.Healthy;
  }

  // Check if any enabled check is still pending
  if (enableWeakCheck && weakPassword === null) {
    return null;
  }
  if (enableReusedCheck && reusedPassword === null) {
    return null;
  }
  if (enableHibpCheck && exposedPassword === null) {
    return null;
  }

  // Check for at-risk conditions based on enabled checks
  const isAtRisk =
    (enableWeakCheck && weakPassword === true) ||
    (enableReusedCheck && reusedPassword === true) ||
    (enableHibpCheck && exposedPassword === true);

  return isAtRisk ? RiskInsightsItemStatus.AtRisk : RiskInsightsItemStatus.Healthy;
}
