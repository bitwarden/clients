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

  private readonly sideNavService = inject(SideNavService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
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
   * Starts the given tour if the user hasn't completed it and no other tour is running.
   * The tour will display steps the user can reach, based on organization membership
   * and whether they have any collections.
   */
  async startTour(tour: CoachmarkTour): Promise<void> {
    if (this.isRunning()) {
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
   * Navigates to the step's route and sets it as active after navigation completes.
   */
  private async navigateToStep(step: CoachmarkStep): Promise<void> {
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

    this.activeStepId.set(step.id);
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
      await this.navigateToStep(steps[currentIndex - 1]);
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
