import { computed, Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { map } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

import { CoachmarkStep, CoachmarkStepId, COACHMARK_STEPS } from "./coachmark-step";

/** State key for tracking coachmark tour completion */
const COACHMARK_TOUR_COMPLETED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "coachmarkTourCompleted",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

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

  /** The applicable steps for the current user (filtered by organization membership) */
  private readonly applicableSteps = signal<CoachmarkStep[]>([]);

  constructor(
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private stateProvider: StateProvider,
    private i18nService: I18nService,
    private router: Router,
  ) {}

  /**
   * Gets the configuration for a specific step.
   */
  getStepConfig(stepId: CoachmarkStepId): CoachmarkStep | undefined {
    return COACHMARK_STEPS.find((s) => s.id === stepId);
  }

  /**
   * Gets translated title for a step.
   */
  getStepTitle(stepId: CoachmarkStepId): string {
    const step = this.getStepConfig(stepId);
    return step ? this.i18nService.t(step.titleKey) : "";
  }

  /**
   * Gets translated description for a step.
   */
  getStepDescription(stepId: CoachmarkStepId): string {
    const step = this.getStepConfig(stepId);
    return step ? this.i18nService.t(step.descriptionKey) : "";
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
   * Starts the coachmark tour if it hasn't been completed yet.
   * The tour will display steps based on user type (org vs non-org).
   */
  async startTour(): Promise<void> {
    if (this.isRunning()) {
      return;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    const completed = await firstValueFrom(
      this.stateProvider
        .getUserState$(COACHMARK_TOUR_COMPLETED_KEY, account.id)
        .pipe(map((v) => v ?? false)),
    );

    if (completed) {
      return;
    }

    const hasOrganizations = await firstValueFrom(
      this.organizationService.hasOrganizations(account.id),
    );

    const steps = COACHMARK_STEPS.filter((step) => !step.requiresOrganization || hasOrganizations);

    if (steps.length === 0) {
      return;
    }

    this.applicableSteps.set(steps);
    await this.navigateToStep(steps[0]);
  }

  /**
   * Navigates to the step's route and sets it as active after navigation completes.
   */
  private async navigateToStep(step: CoachmarkStep): Promise<void> {
    if (step.route) {
      await this.router.navigate([step.route]);
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
   * Completes the tour and persists the completion state.
   */
  async completeTour(): Promise<void> {
    this.activeStepId.set(null);
    this.applicableSteps.set([]);

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await this.stateProvider.setUserState(COACHMARK_TOUR_COMPLETED_KEY, true, account.id);
    }
  }
}
