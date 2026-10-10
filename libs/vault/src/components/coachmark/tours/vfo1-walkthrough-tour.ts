import { InjectionToken } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkStep } from "../coachmark-step";
import { CoachmarkTour } from "../coachmark-tour";

/** The steps each app contributes to the VFO1 walkthrough, in display order */
export const VFO1_WALKTHROUGH_STEPS = new InjectionToken<CoachmarkStep[]>("Vfo1WalkthroughSteps", {
  providedIn: "root",
  factory: () => [],
});

export function vfo1WalkthroughTour(
  nudgesService: NudgesService,
  steps: CoachmarkStep[],
): CoachmarkTour {
  return {
    steps,
    completed: async (userId: UserId) =>
      !(await firstValueFrom(nudgesService.showNudgeSpotlight$(NudgeType.Vfo1Walkthrough, userId))),
    markCompleted: (userId: UserId) =>
      nudgesService.dismissNudge(NudgeType.Vfo1Walkthrough, userId),
    lockSideNav: true,
  };
}
