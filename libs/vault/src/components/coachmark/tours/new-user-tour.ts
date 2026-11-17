import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

import { CoachmarkStep } from "../coachmark-step";
import { CoachmarkTour } from "../coachmark-tour";

const COACHMARK_TOUR_COMPLETED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "coachmarkTourCompleted",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

/** New-user tour steps in display order */
const NEW_USER_TOUR_STEPS: CoachmarkStep[] = [
  {
    id: "importData",
    titleKey: "coachmarkImportTitle",
    descriptionKey: "coachmarkImportDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/import-data/",
    route: "/tools/import",
    // VFO1 drops the Import nav entry — import is a dialog opened from the vault toolbar, so the
    // step anchors that button rather than the import page.
    routeVfo1: "/vault",
  },
  {
    id: "addItem",
    titleKey: "coachmarkAddItemTitle",
    descriptionKey: "coachmarkAddItemDescription",
    position: "below-center",
    learnMoreUrl: "https://bitwarden.com/help/managing-items/",
    route: "/vault",
  },
  {
    id: "shareWithCollections",
    titleKey: "coachmarkShareWithCollectionsTitle",
    descriptionKey: "coachmarkShareWithCollectionsDescription",
    descriptionKeyVfo1: "coachmarkShareWithSharedFoldersDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/about-collections/",
    requiresOrganization: true,
    requiresCollections: true,
    route: "/vault",
    opensSideNav: true,
  },
  {
    id: "monitorSecurity",
    titleKey: "coachmarkMonitorSecurityTitle",
    descriptionKey: "coachmarkMonitorSecurityDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/reports/",
    route: "/reports",
    opensSideNav: true,
  },
];

export function newUserTour(stateProvider: StateProvider): CoachmarkTour {
  return {
    steps: NEW_USER_TOUR_STEPS,
    completed: async (userId: UserId) =>
      (await firstValueFrom(stateProvider.getUserState$(COACHMARK_TOUR_COMPLETED_KEY, userId))) ??
      false,
    markCompleted: async (userId: UserId) => {
      await stateProvider.setUserState(COACHMARK_TOUR_COMPLETED_KEY, true, userId);
    },
    endRoute: "/vault",
  };
}
