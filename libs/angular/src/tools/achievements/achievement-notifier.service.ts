import { firstValueFrom, switchMap, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AchievementService } from "@bitwarden/common/tools/achievements/achievement.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { AchievementIcon } from "./achievement-icon";
import { AchievementNotifierService as AchievementNotifierServiceAbstraction } from "./achievement-notifier.abstraction";

export class AchievementNotifierService implements AchievementNotifierServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private achievementService: AchievementService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  async init() {
    await this.setupListeners();
  }

  private async setupListeners() {
    // FIXME Implement achievements earned filter and notififer
    /* Get the userId from the accountService
     * Subscribe to achievementService.achievementsEarned$(userId)
     * Retrieve current device and filter out messages that are not for this client/device (achievements should be only shown on the device that earned them)
     * Retrieve Achievement by AchievementId via the achievementService
     * Use information from Achievement to fill out the options for the notification (toast)
     * Invoke showing toast
     */
    // FIXME getClientType browswer and achievementEarned.service.name.extension won't match
    const account = await firstValueFrom(this.accountService.activeAccount$);
    this.achievementService
      .achievementsEarned$(account.id)
      .pipe(
        // Removing filter for testing purposes
        // filter(achievementEarned => achievementEarned.service.name == this.platformUtilsService.getClientType())).pipe(
        switchMap((earned) => this.achievementService.achievementById$(earned.achievement.name)),
        tap((achievement) => {
          //eslint-disable-next-line no-console
          console.log(achievement);
        }),
      )
      .subscribe((achievement) => {
        this.toastService.showToast({
          variant: "info",
          title: achievement.name,
          message: achievement.description,
          icon: AchievementIcon,
        });
      });

    // FIXME Migrate to use achievementHub.earned$() instead of achievementService.achievementsEarned$
  }
}
