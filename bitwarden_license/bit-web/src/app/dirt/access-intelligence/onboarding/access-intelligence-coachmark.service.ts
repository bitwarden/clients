import { computed, inject, Injectable, signal } from "@angular/core";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  ACCESS_INTELLIGENCE_COACHMARK_STEPS,
  AccessIntelligenceCoachmarkStep,
  AccessIntelligenceCoachmarkStepId,
} from "./access-intelligence-coachmark-step";
import { OnboardingService } from "./services/onboarding.service";

@Injectable()
export class AccessIntelligenceCoachmarkService {
  private readonly onboardingService = inject(OnboardingService);
  private readonly i18nService = inject(I18nService);

  readonly activeStepId = signal<AccessIntelligenceCoachmarkStepId | null>(null);

  private readonly currentStepIndex = computed(() => {
    const activeId = this.activeStepId();
    if (!activeId) {
      return -1;
    }
    return ACCESS_INTELLIGENCE_COACHMARK_STEPS.findIndex((s) => s.id === activeId);
  });

  readonly currentStepNumber = computed(() => {
    const index = this.currentStepIndex();
    return index >= 0 ? index + 1 : 0;
  });

  readonly totalSteps = computed(() => ACCESS_INTELLIGENCE_COACHMARK_STEPS.length);

  readonly isRunning = computed(() => this.activeStepId() !== null);

  readonly requiredTabIndex = computed<number | null>(() => {
    const step = this.getStepConfig(this.activeStepId());
    return step?.tabIndex ?? null;
  });

  private readonly tourCompleted = new Subject<boolean>();
  readonly tourCompleted$ = this.tourCompleted.asObservable();

  async startTour(_organizationId: OrganizationId): Promise<void> {
    if (this.isRunning()) {
      return;
    }
    const completed = await this.onboardingService.isAICoachmarkTourCompleted();
    if (completed) {
      return;
    }
    this.activeStepId.set(ACCESS_INTELLIGENCE_COACHMARK_STEPS[0].id);
  }

  async goToNextStep(): Promise<void> {
    if (!this.isRunning()) {
      return;
    }
    const currentIndex = this.currentStepIndex();
    if (currentIndex >= ACCESS_INTELLIGENCE_COACHMARK_STEPS.length - 1) {
      await this.completeTour();
    } else {
      this.activeStepId.set(ACCESS_INTELLIGENCE_COACHMARK_STEPS[currentIndex + 1].id);
    }
  }

  goToPreviousStep(): void {
    if (!this.isRunning()) {
      return;
    }
    const currentIndex = this.currentStepIndex();
    if (currentIndex > 0) {
      this.activeStepId.set(ACCESS_INTELLIGENCE_COACHMARK_STEPS[currentIndex - 1].id);
    }
  }

  async skipTour(): Promise<void> {
    this.activeStepId.set(null);
    await this.onboardingService.setAICoachmarkTourCompleted();
  }

  async completeTour(): Promise<void> {
    this.activeStepId.set(null);
    await this.onboardingService.setAICoachmarkTourCompleted();
    this.tourCompleted.next(true);
  }

  getStepConfig(
    id: AccessIntelligenceCoachmarkStepId | null,
  ): AccessIntelligenceCoachmarkStep | undefined {
    if (!id) {
      return undefined;
    }
    return ACCESS_INTELLIGENCE_COACHMARK_STEPS.find((s) => s.id === id);
  }

  getStepTitle(id: AccessIntelligenceCoachmarkStepId | null): string {
    const step = this.getStepConfig(id);
    return step ? this.i18nService.t(step.titleKey) : "";
  }

  getStepDescription(id: AccessIntelligenceCoachmarkStepId | null): string {
    const step = this.getStepConfig(id);
    return step ? this.i18nService.t(step.descriptionKey) : "";
  }

  getStepLearnMoreUrl(id: AccessIntelligenceCoachmarkStepId | null): string | undefined {
    return this.getStepConfig(id)?.learnMoreUrl;
  }
}
