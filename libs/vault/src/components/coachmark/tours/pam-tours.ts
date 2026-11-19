import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { PAM_COACHMARK_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import { CoachmarkStep, CoachmarkStepId } from "../coachmark-step";
import { CoachmarkTour } from "../coachmark-tour";

function completionKey(name: string) {
  return new UserKeyDefinition<boolean>(PAM_COACHMARK_DISK, name, {
    deserializer: (value) => value ?? false,
    clearOn: [],
  });
}

export const PAM_VAULT_TOUR_COMPLETED_KEY = completionKey("pamVaultTourCompleted");
export const PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY = completionKey(
  "pamAccessRequestsTourCompleted",
);
export const PAM_ADMIN_TOUR_COMPLETED_KEY = completionKey("pamAdminTourCompleted");
export const PAM_WELCOME_TOUR_COMPLETED_KEY = completionKey("pamWelcomeTourCompleted");
/** Set by the caller once the PAM welcome modal has been shown. Not a tour completion. */
export const PAM_WELCOME_ACKNOWLEDGED_KEY = completionKey("pamWelcomeAcknowledged");

function buildTour(
  stateProvider: StateProvider,
  key: UserKeyDefinition<boolean>,
  steps: CoachmarkStep[],
): CoachmarkTour {
  return {
    id: key.key,
    steps,
    completed: async (userId: UserId) =>
      (await firstValueFrom(stateProvider.getUserState$(key, userId))) ?? false,
    markCompleted: async (userId: UserId) => {
      await stateProvider.setUserState(key, true, userId);
    },
  };
}

/**
 * Welcome tour, started from the PAM welcome modal. Both steps anchor elements on the vault page
 * (the Controlled access column and the side nav), so it needs no route. The column exists only
 * in the VFO1 vault table, and only while it has items to list, so that step is dropped when its
 * anchor never mounts rather than stalling the tour.
 */
export function pamWelcomeTour(stateProvider: StateProvider): CoachmarkTour {
  return buildTour(stateProvider, PAM_WELCOME_TOUR_COMPLETED_KEY, [
    {
      id: "pamPrivilegedItems",
      titleKey: "pamCoachmarkPrivilegedItemsTitle",
      descriptionKey: "pamCoachmarkPrivilegedItemsDescription",
      position: "below-start",
      skipWhenUnanchored: true,
    },
    {
      id: "pamMyRequestsNav",
      titleKey: "pamCoachmarkMyRequestsNavTitle",
      descriptionKey: "pamCoachmarkMyRequestsNavDescription",
      position: "right-center",
      opensSideNav: true,
    },
  ]);
}

/**
 * End-user vault tour: the request-access control on the gated cipher banner, then the
 * "My requests" nav item. Start it the first time the user opens a gated cipher.
 */
export function pamVaultTour(stateProvider: StateProvider): CoachmarkTour {
  return buildTour(stateProvider, PAM_VAULT_TOUR_COMPLETED_KEY, [
    {
      id: "pamRequestAccess",
      titleKey: "pamCoachmarkRequestAccessTitle",
      descriptionKey: "pamCoachmarkRequestAccessDescription",
      position: "below-center",
      // A start deferred behind a welcome dialog can replay after the gated item was closed.
      endWhenUnanchored: true,
    },
    {
      id: "pamMyRequestsNav",
      titleKey: "pamCoachmarkMyRequestsNavTitle",
      descriptionKey: "pamCoachmarkMyRequestsNavDescription",
      position: "right-center",
      opensSideNav: true,
    },
  ]);
}

/**
 * End-user access requests tour for /pam. The Approvals step is only included when
 * `canApprove` is true. Start it on the first visit to /pam.
 */
export function pamAccessRequestsTour(
  stateProvider: StateProvider,
  canApprove: boolean,
): CoachmarkTour {
  // Tab-bar order: Approvals leads for approvers, since that is where its tab sits.
  const steps: CoachmarkStep[] = [
    ...(canApprove
      ? [
          {
            id: "pamApprovalsTab" as const,
            titleKey: "pamCoachmarkApprovalsTabTitle",
            descriptionKey: "pamCoachmarkApprovalsTabDescription",
            position: "below-start" as const,
          },
        ]
      : []),
    {
      id: "pamMyRequestsTab",
      titleKey: "pamCoachmarkMyRequestsTabTitle",
      descriptionKey: "pamCoachmarkMyRequestsTabDescription",
      position: "below-start",
    },
    {
      id: "pamActiveAccess",
      titleKey: "pamCoachmarkActiveAccessTitle",
      descriptionKey: "pamCoachmarkActiveAccessDescription",
      position: "below-start",
      // The status filter anchor mounts only on the routed My requests tab, once it has rows.
      route: "/pam/my-requests",
    },
    {
      id: "pamHistoryTab",
      titleKey: "pamCoachmarkHistoryTabTitle",
      descriptionKey: "pamCoachmarkHistoryTabDescription",
      position: "below-start",
    },
  ];
  return buildTour(stateProvider, PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY, steps);
}

/** Admin tour steps in display order. Add a Governance entry here once that feature lands. */
const PAM_ADMIN_STEPS: CoachmarkStep[] = [
  {
    id: "pamOrgGroup",
    titleKey: "pamCoachmarkOrgGroupTitle",
    descriptionKey: "pamCoachmarkOrgGroupDescription",
    position: "right-start",
    opensSideNav: true,
  },
  {
    id: "pamAccessRules",
    titleKey: "pamCoachmarkAccessRulesTitle",
    descriptionKey: "pamCoachmarkAccessRulesDescription",
    position: "right-center",
    opensSideNav: true,
  },
  {
    id: "pamAuditLog",
    titleKey: "pamCoachmarkAuditLogTitle",
    descriptionKey: "pamCoachmarkAuditLogDescription",
    position: "right-center",
    opensSideNav: true,
  },
  {
    id: "pamRotation",
    titleKey: "pamCoachmarkRotationTitle",
    descriptionKey: "pamCoachmarkRotationDescription",
    position: "right-center",
    opensSideNav: true,
  },
];

/**
 * Admin tour anchored on the "Privileged controls" org nav group and its items. The group step
 * is always included; item steps are included only when listed in `visibleStepIds`. Steps have
 * no route: they anchor nav entries that are already on screen, so no org-scoped route is needed.
 * The nav stays open for the whole tour.
 */
export function pamAdminTour(
  stateProvider: StateProvider,
  visibleStepIds: ReadonlySet<CoachmarkStepId> | readonly CoachmarkStepId[],
): CoachmarkTour {
  const visible = new Set<CoachmarkStepId>(visibleStepIds);
  const steps = PAM_ADMIN_STEPS.filter((s) => s.id === "pamOrgGroup" || visible.has(s.id));
  return { ...buildTour(stateProvider, PAM_ADMIN_TOUR_COMPLETED_KEY, steps), lockSideNav: true };
}
