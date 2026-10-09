import { inject, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkService } from "../components/coachmark/coachmark.service";
import {
  VFO1_WALKTHROUGH_STEPS,
  vfo1WalkthroughTour,
} from "../components/coachmark/tours/vfo1-walkthrough-tour";

@Injectable({ providedIn: "root" })
export class Vfo1TourCalloutService {
  private readonly nudgesService = inject(NudgesService);
  private readonly coachmarkService = inject(CoachmarkService);
  private readonly steps = inject(VFO1_WALKTHROUGH_STEPS);
  private readonly tourRunning$ = toObservable(this.coachmarkService.isRunning);

  /** Whether the walkthrough has yet to be completed or dismissed */
  walkthroughPending$(userId: UserId): Observable<boolean> {
    return this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1Walkthrough, userId);
  }

  /** Whether the tour callout shows: walkthrough pending, new-look dialog dismissed, no tour running */
  show$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.walkthroughPending$(userId),
      this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1NewExperience, userId),
      this.tourRunning$,
    ]).pipe(
      map(([walkthroughPending, newExperiencePending, running]) => {
        return walkthroughPending && !newExperiencePending && !running;
      }),
    );
  }

  async startTour(): Promise<void> {
    await this.coachmarkService.startTour(vfo1WalkthroughTour(this.nudgesService, this.steps));
  }

  async dismiss(userId: UserId): Promise<void> {
    await this.nudgesService.dismissNudge(NudgeType.Vfo1Walkthrough, userId);
  }
}
