import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkStep } from "./coachmark-step";

/** A sequence of coachmark steps, with how its completion is stored and what happens when it ends */
export interface CoachmarkTour {
  /** Steps in display order; the engine still filters by requiresOrganization / requiresCollections */
  steps: CoachmarkStep[];

  /** Resolves whether the user has already completed this tour */
  completed: (userId: UserId) => Promise<boolean>;

  /** Persists that the user has completed this tour */
  markCompleted: (userId: UserId) => Promise<void>;

  /** Route to navigate to when the tour ends */
  endRoute?: string;

  /** Keeps the side nav open for the whole tour */
  lockSideNav?: boolean;
}
