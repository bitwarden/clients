import { TestBed, fakeAsync, tick } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { ACCESS_INTELLIGENCE_COACHMARK_STEPS } from "./access-intelligence-coachmark-step";
import { AccessIntelligenceCoachmarkService } from "./access-intelligence-coachmark.service";
import { OnboardingService } from "./services/onboarding.service";

describe("AccessIntelligenceCoachmarkService", () => {
  let service: AccessIntelligenceCoachmarkService;

  const mockOrgId = "org-123" as OrganizationId;
  const isAICoachmarkTourCompleted = jest.fn().mockResolvedValue(false);
  const setAICoachmarkTourCompleted = jest.fn().mockResolvedValue(undefined);
  const t = jest.fn((key: string) => key);

  beforeEach(() => {
    jest.resetAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AccessIntelligenceCoachmarkService,
        {
          provide: OnboardingService,
          useValue: { isAICoachmarkTourCompleted, setAICoachmarkTourCompleted },
        },
        { provide: I18nService, useValue: { t } },
      ],
    });

    service = TestBed.inject(AccessIntelligenceCoachmarkService);
  });

  describe("initial state", () => {
    it("is not running", () => {
      expect(service.isRunning()).toBe(false);
    });

    it("activeStepId is null", () => {
      expect(service.activeStepId()).toBeNull();
    });

    it("currentStepNumber is 0", () => {
      expect(service.currentStepNumber()).toBe(0);
    });

    it("totalSteps is 5", () => {
      expect(service.totalSteps()).toBe(5);
    });

    it("requiredTabIndex is null", () => {
      expect(service.requiredTabIndex()).toBeNull();
    });
  });

  describe("startTour", () => {
    it("sets first step and starts running", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      expect(service.isRunning()).toBe(true);
      expect(service.activeStepId()).toBe("monitorActivity");
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("does not restart or reset progress if already running", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      await service.goToNextStep();
      tick(); // advance to step 2 so a reset would be observable

      await service.startTour(mockOrgId);
      tick();

      expect(service.activeStepId()).toBe("prioritizeRisks");
      expect(service.currentStepNumber()).toBe(2);
    }));

    it("does not start if tour already completed", fakeAsync(async () => {
      isAICoachmarkTourCompleted.mockResolvedValue(true);
      await service.startTour(mockOrgId);
      tick();
      expect(service.isRunning()).toBe(false);
    }));

    it("sets requiredTabIndex to 0 on start", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      expect(service.requiredTabIndex()).toBe(0);
    }));
  });

  describe("goToNextStep", () => {
    beforeEach(fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
    }));

    it("advances to step 2", fakeAsync(async () => {
      await service.goToNextStep();
      tick();
      expect(service.activeStepId()).toBe("prioritizeRisks");
      expect(service.currentStepNumber()).toBe(2);
    }));

    it("advances through all steps", fakeAsync(async () => {
      await service.goToNextStep();
      tick(); // step 2
      await service.goToNextStep();
      tick(); // step 3
      await service.goToNextStep();
      tick(); // step 4
      expect(service.activeStepId()).toBe("helpMembers");
      expect(service.currentStepNumber()).toBe(4);
    }));

    it("calls completeTour on last step", fakeAsync(async () => {
      await service.goToNextStep();
      tick(); // step 2
      await service.goToNextStep();
      tick(); // step 3
      await service.goToNextStep();
      tick(); // step 4
      await service.goToNextStep();
      tick(); // step 5 (runReport)
      await service.goToNextStep();
      tick(); // Done — triggers completeTour
      expect(service.isRunning()).toBe(false);
      expect(setAICoachmarkTourCompleted).toHaveBeenCalled();
    }));

    it("emits tourCompleted$ on last step", fakeAsync(async () => {
      const completed = jest.fn();
      service.tourCompleted$.subscribe(completed);

      for (let i = 0; i < ACCESS_INTELLIGENCE_COACHMARK_STEPS.length; i++) {
        await service.goToNextStep();
        tick();
      }

      expect(completed).toHaveBeenCalledWith(true);
    }));

    it("does nothing when tour is not running", fakeAsync(async () => {
      await service.completeTour();
      tick();
      const stepBefore = service.activeStepId();
      await service.goToNextStep();
      tick();
      expect(service.activeStepId()).toBe(stepBefore);
    }));
  });

  describe("goToPreviousStep", () => {
    beforeEach(fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      await service.goToNextStep();
      tick(); // now on step 2
    }));

    it("goes back to step 1", fakeAsync(async () => {
      service.goToPreviousStep();
      tick();
      expect(service.activeStepId()).toBe("monitorActivity");
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("does not go before step 1", fakeAsync(async () => {
      service.goToPreviousStep();
      tick(); // back to step 1
      service.goToPreviousStep();
      tick(); // no-op
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("does nothing when tour is not running", fakeAsync(async () => {
      await service.skipTour();
      tick();
      service.goToPreviousStep();
      tick();
      expect(service.isRunning()).toBe(false);
    }));
  });

  describe("skipTour", () => {
    beforeEach(fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
    }));

    it("stops the tour", fakeAsync(async () => {
      await service.skipTour();
      tick();
      expect(service.isRunning()).toBe(false);
      expect(service.activeStepId()).toBeNull();
    }));

    it("persists completion", fakeAsync(async () => {
      await service.skipTour();
      tick();
      expect(setAICoachmarkTourCompleted).toHaveBeenCalled();
    }));

    it("does not emit tourCompleted$", fakeAsync(async () => {
      const completed = jest.fn();
      service.tourCompleted$.subscribe(completed);
      await service.skipTour();
      tick();
      expect(completed).not.toHaveBeenCalledWith(true);
    }));
  });

  describe("completeTour", () => {
    beforeEach(fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
    }));

    it("stops the tour", fakeAsync(async () => {
      await service.completeTour();
      tick();
      expect(service.isRunning()).toBe(false);
    }));

    it("persists completion", fakeAsync(async () => {
      await service.completeTour();
      tick();
      expect(setAICoachmarkTourCompleted).toHaveBeenCalled();
    }));

    it("emits tourCompleted$", fakeAsync(async () => {
      const completed = jest.fn();
      service.tourCompleted$.subscribe(completed);
      await service.completeTour();
      tick();
      expect(completed).toHaveBeenLastCalledWith(true);
    }));
  });

  describe("getStepConfig", () => {
    it("returns config for a known step", () => {
      const config = service.getStepConfig("monitorActivity");
      expect(config).toEqual(ACCESS_INTELLIGENCE_COACHMARK_STEPS[0]);
    });

    it("returns undefined for null", () => {
      expect(service.getStepConfig(null)).toBeUndefined();
    });
  });

  describe("getStepTitle", () => {
    it("calls i18nService with titleKey", () => {
      service.getStepTitle("monitorActivity");
      expect(t).toHaveBeenCalledWith("aiCoachmarkMonitorActivityTitle");
    });

    it("returns empty string for null", () => {
      expect(service.getStepTitle(null)).toBe("");
    });
  });

  describe("requiredTabIndex signal", () => {
    it("returns 0 for step 1", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      expect(service.requiredTabIndex()).toBe(0);
    }));

    it("returns 2 when step is criticalApplications", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      await service.goToNextStep();
      tick(); // step 2
      await service.goToNextStep();
      tick(); // step 3 = criticalApplications
      expect(service.requiredTabIndex()).toBe(2);
    }));

    it("returns 0 for step 5 (runReport)", fakeAsync(async () => {
      await service.startTour(mockOrgId);
      tick();
      for (let i = 0; i < 4; i++) {
        await service.goToNextStep();
        tick();
      }
      expect(service.activeStepId()).toBe("runReport");
      expect(service.requiredTabIndex()).toBe(0);
    }));
  });
});
