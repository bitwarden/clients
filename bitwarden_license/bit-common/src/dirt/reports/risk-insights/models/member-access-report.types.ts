/**
 * Effective permission level for a member's access to ciphers (const object pattern per ADR-0025)
 * Priority order: Manage > Edit > ViewOnly > HidePasswords
 */
export const EffectivePermissionLevel = Object.freeze({
  Manage: "manage",
  Edit: "edit",
  ViewOnly: "view-only",
  HidePasswords: "hide-passwords",
} as const);
export type EffectivePermissionLevel =
  (typeof EffectivePermissionLevel)[keyof typeof EffectivePermissionLevel];

/**
 * Loading states for the member access report (const object pattern per ADR-0025)
 */
export const MemberAccessReportState = Object.freeze({
  Idle: "idle",
  LoadingCiphers: "loading-ciphers",
  ProcessingMembers: "processing-members",
  Complete: "complete",
  Error: "error",
} as const);
export type MemberAccessReportState =
  (typeof MemberAccessReportState)[keyof typeof MemberAccessReportState];

/**
 * Summary view model for a single member's access across all ciphers.
 * This is the member-centric view pivoted from cipher-centric data.
 */
export interface MemberAccessSummary {
  /** The user's organization member ID */
  userId: string;

  /** The user's email address */
  email: string;

  /** The user's display name (may be null if not set) */
  name: string | null;

  /** Total number of ciphers this member has access to */
  cipherCount: number;

  /** Number of unique collections this member has access to */
  collectionCount: number;

  /** Number of unique groups this member belongs to that grant cipher access */
  groupCount: number;

  /** The highest permission level across all access paths */
  highestPermission: EffectivePermissionLevel;
}

/**
 * Progressive result emitted during streaming member access report generation.
 * Enables incremental UI updates as batches of cipher data are processed.
 */
export interface MemberAccessReportProgressiveResult {
  /** Current state of report generation */
  state: MemberAccessReportState;

  /** Member summaries computed so far (grows with each batch) */
  members: MemberAccessSummary[];

  /** Number of ciphers processed so far */
  processedCipherCount: number;

  /** Total number of ciphers to process */
  totalCipherCount: number;

  /** Percentage complete (0-100) */
  progressPercent: number;

  /** Error message if state is Error */
  error?: string;
}

/**
 * Detail of a member's access to a specific collection via a specific access path.
 * Groups ciphers by collection+accessType+groupId for detailed breakdown.
 */
export interface MemberCollectionAccessDetail {
  /** The collection ID */
  collectionId: string;

  /** The collection display name */
  collectionName: string;

  /** Number of ciphers accessible via this path */
  cipherCount: number;

  /** Permission level for this access path */
  permission: EffectivePermissionLevel;

  /** How access was granted: "direct" or "group" */
  accessType: "direct" | "group";

  /** Group name if accessType is "group", null otherwise */
  groupName: string | null;

  /** Group ID if accessType is "group", null otherwise */
  groupId: string | null;
}

/**
 * Detailed view of a single member's access across all collections.
 * Used for displaying drill-down information in the detail dialog.
 */
export interface MemberAccessDetailView {
  /** The user's organization member ID */
  userId: string;

  /** The user's email address */
  email: string;

  /** The user's display name (may be null if not set) */
  name: string | null;

  /** Total number of unique ciphers this member can access */
  totalCipherCount: number;

  /** Breakdown of access by collection and access type */
  collectionDetails: MemberCollectionAccessDetail[];
}
