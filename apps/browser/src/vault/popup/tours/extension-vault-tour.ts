import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";
import { CoachmarkStep, CoachmarkTour } from "@bitwarden/vault";

const EXTENSION_VAULT_TOUR_COMPLETED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "extensionVaultTourCompleted",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

/** Extension vault tour steps in display order */
const EXTENSION_VAULT_TOUR_STEPS: CoachmarkStep[] = [
  {
    id: "switchVaults",
    titleKey: "coachmarkSwitchVaultsTitle",
    descriptionKey: "coachmarkSwitchVaultsDescription",
    position: "below-start",
  },
  {
    id: "mixAndMatchFilters",
    titleKey: "coachmarkMixAndMatchFiltersTitle",
    descriptionKey: "coachmarkMixAndMatchFiltersDescription",
    position: "below-end",
  },
  {
    id: "newDashboard",
    titleKey: "coachmarkNewDashboardTitle",
    descriptionKey: "coachmarkNewDashboardDescription",
    position: "above-center",
    // Anchors the Shared folders row of the filter dialog, which only lists it for collections.
    requiresCollections: true,
  },
];

/**
 * Introduces the redesigned extension vault.
 *
 * @param hasMultipleVaults whether the vault switcher renders; it is hidden for a lone vault, so
 * its step is dropped rather than left with nothing to anchor to.
 */
export function extensionVaultTour(
  stateProvider: StateProvider,
  hasMultipleVaults: boolean,
): CoachmarkTour {
  return {
    steps: EXTENSION_VAULT_TOUR_STEPS.filter(
      (step) => hasMultipleVaults || step.id !== "switchVaults",
    ),
    completed: async (userId: UserId) =>
      (await firstValueFrom(
        stateProvider.getUserState$(EXTENSION_VAULT_TOUR_COMPLETED_KEY, userId),
      )) ?? false,
    markCompleted: async (userId: UserId) => {
      await stateProvider.setUserState(EXTENSION_VAULT_TOUR_COMPLETED_KEY, true, userId);
    },
  };
}
