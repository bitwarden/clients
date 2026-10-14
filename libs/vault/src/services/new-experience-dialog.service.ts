import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import {
  NewExperienceDialogComponent,
  NewExperienceDialogParams,
} from "../components/new-experience-dialog/new-experience-dialog.component";

/**
 * Decides whether {@link NewExperienceDialogComponent} should announce the redesigned vault.
 *
 * Every client shows the same dialog under the same rules, so the rules live here rather than in
 * each client's vault page. Callers supply their own screenshots and apply whatever additional
 * gating is specific to them — the extension, for instance, waits until its intro carousel has
 * been seen.
 */
@Injectable({ providedIn: "root" })
export class NewExperienceDialogService {
  private readonly configService = inject(ConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly nudgesService = inject(NudgesService);

  /**
   * Opens the dialog when the account predates the redesign and has not been told about it yet.
   * The dialog dismisses the nudge itself, and only from one of its actions, so leaving it any
   * other way shows it again next time.
   *
   * @returns whether the dialog opened.
   */
  async conditionallyOpen(
    userId: UserId,
    params: Omit<NewExperienceDialogParams, "userId">,
  ): Promise<boolean> {
    const vfo1Enabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    );
    if (!vfo1Enabled) {
      return false;
    }

    // This dialog opens without a click, so a server that suppresses onboarding suppresses it.
    const serverSettings = await firstValueFrom(this.configService.serverSettings$);
    if (serverSettings?.suppressOnboardingInterstitials) {
      return false;
    }

    // Vfo1OnboardingNudgeService reports dismissed for accounts created on or after GA, so those
    // users are never told about a change they did not experience.
    const showDialog = await firstValueFrom(
      this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1NewExperience, userId),
    );
    if (!showDialog) {
      return false;
    }

    await NewExperienceDialogComponent.open(this.dialogService, { ...params, userId });

    return true;
  }
}
