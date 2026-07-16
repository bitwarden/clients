import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Generic read-only signal interface for framework-agnostic abstraction.
 * This mirrors Angular's Signal interface without requiring Angular as a dependency.
 */
export interface ReadonlySignal<T> {
  (): T;
}

/**
 * State of access intelligence processing (per ADR-0025 - no enums)
 */
export const AccessIntelligenceState = Object.freeze({
  Idle: "idle",
  LoadingCiphers: "loading-ciphers",
  ProcessingHealth: "processing-health",
  LoadingOrganizationData: "loading-org-data",
  MappingAccess: "mapping-access",
  Complete: "complete",
  Error: "error",
} as const);
export type AccessIntelligenceState =
  (typeof AccessIntelligenceState)[keyof typeof AccessIntelligenceState];

/**
 * Progress information for tracking operation completion
 */
export interface AccessIntelligenceProgress {
  /** Number of items processed so far */
  current: number;
  /** Total number of items to process */
  total: number;
  /** Progress percentage (0-100) */
  percent: number;
}

/**
 * Health check result for a single cipher
 */
export interface CipherHealthResult {
  /** Cipher ID */
  cipherId: string;
  /** Whether the password is weak */
  isWeak: boolean;
  /** Weak password score (0-4, lower is weaker) */
  weakScore?: number;
  /** Whether the password is reused across multiple ciphers */
  isReused: boolean;
  /** Whether the password has been exposed in breaches */
  isExposed: boolean;
  /** Number of times the password has been exposed */
  exposedCount?: number;
}

/**
 * Information about how a member has access to a cipher
 */
export interface CipherMemberAccessInfo {
  /** User ID */
  userId: string;
  /** User email */
  email: string | null;
  /** Type of access (direct assignment or via group) */
  accessType: "direct" | "group";
  /** Collection ID through which access is granted */
  collectionId: string;
  /** Collection name */
  collectionName: string;
  /** Group ID if access is via group */
  groupId?: string;
  /** Group name if access is via group */
  groupName?: string;
  /** Whether the user can edit */
  canEdit: boolean;
  /** Whether the user can view passwords */
  canViewPasswords: boolean;
  /** Whether the user can manage */
  canManage: boolean;
}

/**
 * A cipher with its health check results and member access information
 */
export interface AccessIntelligenceCipher {
  /** The cipher view */
  cipher: CipherView;
  /** Health check results */
  health: CipherHealthResult;
  /** Members with access to this cipher */
  members: CipherMemberAccessInfo[];
  /** Total number of unique members with access */
  memberCount: number;
}

/**
 * Final result of access intelligence analysis
 */
export interface AccessIntelligenceResult {
  /** All ciphers with their health and access information */
  ciphers: AccessIntelligenceCipher[];
  /** Total number of ciphers analyzed */
  totalCipherCount: number;
  /** Number of ciphers with at least one health risk */
  atRiskCipherCount: number;
  /** Total number of unique members with access to any cipher */
  totalMemberCount: number;
  /** Number of members with access to at least one at-risk cipher */
  atRiskMemberCount: number;
}

/**
 * Creates an initial progress object
 */
export function createInitialProgress(): AccessIntelligenceProgress {
  return {
    current: 0,
    total: 0,
    percent: 0,
  };
}

/**
 * Creates a progress object with calculated percentage
 */
export function createProgress(current: number, total: number): AccessIntelligenceProgress {
  return {
    current,
    total,
    percent: total > 0 ? Math.round((current / total) * 100) : 0,
  };
}

/**
 * Determines if a cipher is at risk based on its health result
 */
export function isAtRiskCipher(health: CipherHealthResult): boolean {
  return health.isWeak || health.isReused || health.isExposed;
}
