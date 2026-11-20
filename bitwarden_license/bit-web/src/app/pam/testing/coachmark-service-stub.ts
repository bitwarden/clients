import { signal } from "@angular/core";

import { CoachmarkService } from "@bitwarden/vault";

/** An inert tour engine for stories, since the real one needs the side nav and router. */
export const coachmarkServiceStub = {
  provide: CoachmarkService,
  useValue: {
    isStepActive: (): boolean => false,
    getStepPosition: (): undefined => undefined,
    getStepTitle: (): string => "",
    getStepDescription: (): string => "",
    getStepLearnMoreUrl: (): undefined => undefined,
    currentStepNumber: signal(1),
    totalSteps: signal(1),
    startTour: (): Promise<void> => Promise.resolve(),
  },
};
