import { firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { UserId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

import { CoachmarkStep } from "../coachmark-step";
import { CoachmarkTour } from "../coachmark-tour";

/** The steps each app contributes to the VFO1 walkthrough, in display order */
export const VFO1_WALKTHROUGH_STEPS = new SafeInjectionToken<CoachmarkStep[]>(
  "Vfo1WalkthroughSteps",
  { providedIn: "root", factory: () => [] },
);

export const VFO1_SWITCH_PRODUCTS_STEP: CoachmarkStep = {
  id: "switchProducts",
  titleKey: "coachmarkSwitchProductsTitle",
  descriptionKey: "coachmarkSwitchProductsDescription",
  position: "right-start",
  opensSideNav: true,
};

export const VFO1_VAULT_LIST_STEP: CoachmarkStep = {
  id: "vaultList",
  titleKey: "coachmarkVaultListTitle",
  descriptionKey: "coachmarkVaultListDescription",
  position: "right-start",
  requiresOrganization: true,
  route: "/vault",
  opensSideNav: true,
};

export const VFO1_SHARED_FOLDERS_STEP: CoachmarkStep = {
  id: "sharedFolders",
  titleKey: "coachmarkSharedFoldersTitle",
  descriptionKey: "coachmarkSharedFoldersDescription",
  position: "right-start",
  requiresOrganization: true,
  route: "/vault",
  opensSideNav: true,
};

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
