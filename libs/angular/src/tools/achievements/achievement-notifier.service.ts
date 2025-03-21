import { concat, filter, map, mergeAll, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AchievementService } from "@bitwarden/common/tools/achievements/achievement.service.abstraction";
import { Achievement } from "@bitwarden/common/tools/achievements/types";
import { UserId } from "@bitwarden/common/types/guid";
import { Icon, ToastService } from "@bitwarden/components";

import { AchievementNotifierService as AchievementNotifierServiceAbstraction } from "./achievement-notifier.abstraction";
import { AchievementIcon } from "./icons/achievement.icon";
import { iconMap } from "./icons/icon-map";

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
    this.accountService.accounts$
      .pipe(
        switchMap((accounts) => {
          const earned$ = Array.from(Object.entries(accounts), ([id, value]) => {
            const account = { ...value, id: id as UserId };
            const metadata = this.achievementService.achievementMap();
            const achievements = this.achievementService.earnedStream$(account).pipe(
              map((earned) => metadata.get(earned.achievement.name)),
              // FIXME: exclude achievements earned on another device
              filter((earned): earned is Achievement => !!earned),
            );

            return achievements;
          });
          return concat(earned$);
        }),
        mergeAll(),
      )
      .subscribe((achievement) => {
        this.toastService.showToast({
          variant: "info",
          title: achievement.name,
          message: achievement.description ?? "",
          icon: this.lookupIcon(achievement.achievement),
        });
      });
  }

  lookupIcon(achievementName: string): Icon {
    return (iconMap[achievementName] as Icon) ?? AchievementIcon;
  }
}
