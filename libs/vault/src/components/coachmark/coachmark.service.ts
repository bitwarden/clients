import { DOCUMENT } from "@angular/common";
import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { map } from "rxjs/operators";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SideNavService } from "@bitwarden/components";

import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { CoachmarkStep, CoachmarkStepId } from "./coachmark-step";
import { CoachmarkTour } from "./coachmark-tour";

const ANCHOR_WAIT_MS = 1000;
const ANCHOR_POLL_MS = 50;

@Injectable({
  providedIn: "root",
})
export class CoachmarkService {
  /** The currently active step ID, or null if tour is not running */
  readonly activeStepId = signal<CoachmarkStepId | null>(null);

  /** Current step number (1-indexed) */
  readonly currentStepNumber = computed(() => {
    const activeId = this.activeStepId();
    if (!activeId) {
      return 0;
    }
    const index = this.applicableSteps().findIndex((s) => s.id === activeId);
    return index >= 0 ? index + 1 : 0;
  });

  /** Total number of steps in the tour */
  readonly totalSteps = computed(() => this.applicableSteps().length);

  /** Whether the tour is currently running */
  readonly isRunning = computed(() => this.activeStepId() !== null);

  /** The applicable steps for the current user (filtered by organization membership and collection access) */
  private readonly applicableSteps = signal<CoachmarkStep[]>([]);

  private readonly activeTour = signal<CoachmarkTour | null>(null);

  private activeHolds = 0;

  /** Start requests deferred by a hold: latest per tour, in order of arrival. */
  private readonly deferredStarts = new Map<string | CoachmarkTour, CoachmarkTour>();

  private readonly sideNavService = inject(SideNavService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);
  private readonly collectionService = inject(CollectionService);

  constructor() {
    effect(() => {
      if (this.activeTour()?.lockSideNav && !this.sideNavService.open()) {
        this.sideNavService.open.set(true);
      }
    });
  }

  /** Whether the named step is the one the tour is on. */
  isStepActive(stepId: CoachmarkStepId): boolean {
    return this.activeStepId() === stepId;
  }

  /**
   * Gets the configuration for a specific step.
   */
  getStepConfig(stepId: CoachmarkStepId): CoachmarkStep | undefined {
    return this.activeTour()?.steps.find((s) => s.id === stepId);
  }

  /**
   * Gets translated title for a step.
   */
  getStepTitle(stepId: CoachmarkStepId): string {
    const step = this.getStepConfig(stepId);
    if (!step) {
      return "";
    }
    const key =
      this.vfo1TerminologyService.enabled() && step.titleKeyVfo1
        ? step.titleKeyVfo1
        : step.titleKey;
    return this.i18nService.t(key);
  }

  /**
   * Gets translated description for a step.
   */
  getStepDescription(stepId: CoachmarkStepId): string {
    const step = this.getStepConfig(stepId);
    if (!step) {
      return "";
    }
    const key =
      this.vfo1TerminologyService.enabled() && step.descriptionKeyVfo1
        ? step.descriptionKeyVfo1
        : step.descriptionKey;
    return this.i18nService.t(key);
  }

  /**
   * Gets learn more URL for a step.
   */
  getStepLearnMoreUrl(stepId: CoachmarkStepId): string | undefined {
    const step = this.getStepConfig(stepId);
    return step?.learnMoreUrl;
  }

  /**
   * Gets the position for a step's popover.
   */
  getStepPosition(stepId: CoachmarkStepId): CoachmarkStep["position"] | undefined {
    const step = this.getStepConfig(stepId);
    return step?.position;
  }

  /**
   * Defers every `startTour` call until the returned function has been called, for example while
   * an onboarding dialog is open. Holds stack: deferred requests replay, in order of arrival and
   * through the normal `startTour` checks, once the last hold is released. Only the latest
   * request per tour is kept. Releasing more than once is a no-op.
   */
  holdStarts(): () => void {
    this.activeHolds++;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.activeHolds--;
      if (this.activeHolds === 0) {
        void this.replayDeferredStarts();
      }
    };
  }

  private async replayDeferredStarts(): Promise<void> {
    const deferred = [...this.deferredStarts.values()];
    this.deferredStarts.clear();
    for (const tour of deferred) {
      await this.startTour(tour);
    }
  }

  /**
   * Starts the given tour if the user hasn't completed it and no other tour is running.
   * The tour will display steps the user can reach, based on organization membership
   * and whether they have any collections.
   */
  async startTour(tour: CoachmarkTour): Promise<void> {
    if (this.activeHolds > 0) {
      const key = tour.id ?? tour;
      this.deferredStarts.delete(key);
      this.deferredStarts.set(key, tour);
      return;
    }

    // A tour mid-start (waiting on its route or anchor) is not yet running but holds the engine.
    if (this.isRunning() || this.activeTour() !== null) {
      return;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    if (await tour.completed(account.id)) {
      return;
    }

    const [hasOrganizations, hasCollections] = await Promise.all([
      firstValueFrom(this.organizationService.hasOrganizations(account.id)),
      firstValueFrom(
        this.collectionService
          .decryptedCollections$(account.id)
          .pipe(map((collections) => collections.length > 0)),
      ),
    ]);

    const steps = tour.steps.filter(
      (step) =>
        (!step.requiresOrganization || hasOrganizations) &&
        (!step.requiresCollections || hasCollections),
    );

    if (steps.length === 0) {
      return;
    }

    this.activeTour.set(tour);
    this.applicableSteps.set(steps);
    await this.navigateToStep(steps[0]);
  }

  /**
   * Navigates to the step's route and sets it as active after navigation completes. A step
   * flagged `skipWhenUnanchored` whose anchor never mounts is dropped from the tour, and the
   * step beyond it in `direction` is shown instead.
   */
  private async navigateToStep(step: CoachmarkStep, direction: 1 | -1 = 1): Promise<void> {
    // Before the navigation, so the anchored entry mounts in an earlier change detection cycle
    // than the one that opens the popover — see `VaultNavSectionComponent.coachmarkExpands`.
    if (step.opensSideNav) {
      this.sideNavService.open.set(true);
    }

    const route =
      this.vfo1TerminologyService.enabled() && step.routeVfo1 ? step.routeVfo1 : step.route;

    if (route) {
      await this.router.navigate([route]);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (
      (step.skipWhenUnanchored || step.endWhenUnanchored) &&
      !(await this.anchorMounted(step.id))
    ) {
      if (step.endWhenUnanchored) {
        this.abandonTour();
      } else {
        await this.dropStep(step, direction);
      }
      return;
    }

    this.activeStepId.set(step.id);
  }

  /** Waits briefly for a slow-rendering anchor before giving up on it. */
  private async anchorMounted(stepId: CoachmarkStepId): Promise<boolean> {
    const mounted = () =>
      this.document.querySelector(`vault-coachmark[data-coachmark-step="${stepId}"]`) != null;
    for (let waited = 0; waited < ANCHOR_WAIT_MS && !mounted(); waited += ANCHOR_POLL_MS) {
      await new Promise((resolve) => setTimeout(resolve, ANCHOR_POLL_MS));
    }
    return mounted();
  }

  /** Ends the tour without persisting completion, so a later start can show it. */
  private abandonTour() {
    this.activeStepId.set(null);
    this.applicableSteps.set([]);
    this.activeTour.set(null);
  }

  private async dropStep(step: CoachmarkStep, direction: 1 | -1): Promise<void> {
    const before = this.applicableSteps();
    const index = before.indexOf(step);
    const remaining = before.filter((s) => s !== step);
    this.applicableSteps.set(remaining);

    // Forward, the step after the dropped one now sits at its index; backward, the one before.
    const target = remaining[direction === 1 ? index : index - 1];
    if (target != null) {
      await this.navigateToStep(target, direction);
    } else if (this.activeStepId() == null) {
      // Nothing was ever shown, so end quietly rather than marking the tour complete.
      this.applicableSteps.set([]);
      this.activeTour.set(null);
    } else if (direction === 1) {
      await this.completeTour();
    }
    // Going back past the first step: stay on the current one.
  }

  /**
   * Moves to the next step in the tour, or completes if on the last step.
   */
  async nextStep(): Promise<void> {
    if (!this.isRunning()) {
      return;
    }

    const steps = this.applicableSteps();
    const currentIndex = steps.findIndex((s) => s.id === this.activeStepId());

    if (currentIndex >= steps.length - 1) {
      await this.completeTour();
    } else {
      await this.navigateToStep(steps[currentIndex + 1]);
    }
  }

  /**
   * Moves to the previous step in the tour.
   */
  async previousStep(): Promise<void> {
    if (!this.isRunning()) {
      return;
    }

    const steps = this.applicableSteps();
    const currentIndex = steps.findIndex((s) => s.id === this.activeStepId());

    if (currentIndex > 0) {
      await this.navigateToStep(steps[currentIndex - 1], -1);
    }
  }

  /**
   * Completes the tour, persists the completion state, and navigates to the tour's end route.
   */
  async completeTour(): Promise<void> {
    const tour = this.activeTour();
    this.activeStepId.set(null);
    this.applicableSteps.set([]);
    this.activeTour.set(null);

    if (!tour) {
      return;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await tour.markCompleted(account.id);
    }

    if (tour.endRoute) {
      await this.router.navigate([tour.endRoute]);
    }
  }
}
