/**
 * Progress steps for the Member Access Report generation.
 * Uses const object pattern per ADR-0025 (no TypeScript enums).
 */
export const MemberAccessProgress = Object.freeze({
  FetchingMembers: 1,
  FetchingCollections: 2,
  FetchingGroups: 3,
  FetchingCipherCounts: 4,
  BuildingMaps: 5,
  ProcessingMembers: 6,
  Complete: 7,
} as const);

export type MemberAccessProgressStep =
  (typeof MemberAccessProgress)[keyof typeof MemberAccessProgress];

/**
 * State object for tracking progress during report generation.
 * Used by the loading component to display progress bar and messages.
 */
export interface MemberAccessProgressState {
  /** Current step in the progress workflow */
  step: MemberAccessProgressStep;
  /** Number of members processed (relevant during ProcessingMembers step) */
  processedMembers: number;
  /** Total number of members to process */
  totalMembers: number;
  /** Human-readable message describing current operation */
  message: string;
}

/**
 * Configuration for each progress step including display message and progress percentage.
 */
export const MemberAccessProgressConfig = Object.freeze({
  [MemberAccessProgress.FetchingMembers]: {
    messageKey: "fetchingMemberData",
    progress: 10,
  },
  [MemberAccessProgress.FetchingCollections]: {
    messageKey: "fetchingCollections",
    progress: 20,
  },
  [MemberAccessProgress.FetchingGroups]: {
    messageKey: "fetchingGroups",
    progress: 25,
  },
  [MemberAccessProgress.FetchingCipherCounts]: {
    messageKey: "fetchingItems",
    progress: 30,
  },
  [MemberAccessProgress.BuildingMaps]: {
    messageKey: "processingData",
    progress: 35,
  },
  [MemberAccessProgress.ProcessingMembers]: {
    messageKey: "processingMembers",
    // Progress is dynamic: 35% + (processed/total * 60%) → ranges from 35% to 95%
    progress: 35,
  },
  [MemberAccessProgress.Complete]: {
    messageKey: "reportGenerationComplete",
    progress: 100,
  },
} as const);

/**
 * Calculates the progress percentage based on the current state.
 * For the ProcessingMembers step, progress is calculated dynamically based on member count.
 */
export function calculateProgressPercentage(state: MemberAccessProgressState): number {
  if (state.step === MemberAccessProgress.ProcessingMembers && state.totalMembers > 0) {
    // Dynamic: 35% + (processed/total * 60%) → ranges from 35% to 95%
    const memberProgress = (state.processedMembers / state.totalMembers) * 60;
    return Math.min(95, 35 + memberProgress);
  }
  return MemberAccessProgressConfig[state.step].progress;
}
