import { inject, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkStep } from "../components/coachmark/coachmark-step";
import { CoachmarkService } from "../components/coachmark/coachmark.service";
import {
  VFO1_VAULT_LIST_STEP,
  VFO1_WALKTHROUGH_STEPS,
  vfo1WalkthroughTour,
} from "../components/coachmark/tours/vfo1-walkthrough-tour";
import { showsVaultsSection } from "../models/vault-scope";

import { VaultNavService } from "./vault-nav.service";

@Injectable({ providedIn: "root" })
export class Vfo1TourCalloutService {
  private readonly nudgesService = inject(NudgesService);
  private readonly coachmarkService = inject(CoachmarkService);
  private readonly accountService = inject(AccountService);
  private readonly vaultNavService = inject(VaultNavService);
  private readonly steps = inject<CoachmarkStep[]>(VFO1_WALKTHROUGH_STEPS);
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

  /** Starts the walkthrough, without the vault list step when the nav has no Vaults header to point at. */
  async startTour(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const hasVaultsSection = await firstValueFrom(
      this.vaultNavService.viewModel$(userId).pipe(map(showsVaultsSection)),
    );
    const steps = this.steps.filter(
      (step) => hasVaultsSection || step.id !== VFO1_VAULT_LIST_STEP.id,
    );

    await this.coachmarkService.startTour(vfo1WalkthroughTour(this.nudgesService, steps));
  }

  async dismiss(userId: UserId): Promise<void> {
    await this.nudgesService.dismissNudge(NudgeType.Vfo1Walkthrough, userId);
  }
}
