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

  /** Whether the tour callout owns the callout slot: walkthrough pending and new-look dialog dismissed */
  claimsSlot$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1Walkthrough, userId),
      this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1NewExperience, userId),
    ]).pipe(
      map(([walkthroughPending, newExperiencePending]) => {
        return walkthroughPending && !newExperiencePending;
      }),
    );
  }

  /** Whether the tour callout shows: it claims the slot and no tour is running */
  show$(userId: UserId): Observable<boolean> {
    return combineLatest([this.claimsSlot$(userId), this.tourRunning$]).pipe(
      map(([claimsSlot, running]) => claimsSlot && !running),
    );
  }

  async startTour(): Promise<void> {
    await this.coachmarkService.startTour(vfo1WalkthroughTour(this.nudgesService, this.steps));
  }

  async dismiss(userId: UserId): Promise<void> {
    await this.nudgesService.dismissNudge(NudgeType.Vfo1Walkthrough, userId);
  }
}
