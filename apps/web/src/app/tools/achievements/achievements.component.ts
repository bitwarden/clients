import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AchievementNotifierService } from "@bitwarden/angular/tools/achievements/achievement-notifier.abstraction";
import { AchievementsListComponent } from "@bitwarden/angular/tools/achievements/achievements-list.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventStoreAbstraction } from "@bitwarden/common/tools/achievements/event-store.abstraction.service";
import { VaultItems_10_Added_Achievement } from "@bitwarden/common/tools/achievements/examples/achievements";
import { AchievementEarnedEvent, AchievementId } from "@bitwarden/common/tools/achievements/types";
import { UserId } from "@bitwarden/common/types/guid";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "achievements.component.html",
  standalone: true,
  imports: [SharedModule, HeaderModule, AchievementsListComponent],
})
export class AchievementsComponent implements OnInit {
  private currentUserId: UserId;

  constructor(
    private eventStore: EventStoreAbstraction,
    private achievementNotifierService: AchievementNotifierService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    await this.achievementNotifierService.init();
    this.currentUserId = (await firstValueFrom(this.accountService.activeAccount$)).id;
  }

  testAchievement() {
    const earnedAchievement: AchievementEarnedEvent = {
      "@timestamp": Date.now(),
      event: {
        kind: "alert",
        category: "session",
      },
      service: {
        name: "web",
        type: "client",
        node: {
          name: "an-installation-identifier-for-this-client-instance",
        },
        environment: "local",
        version: "2025.3.1-innovation-sprint",
      },
      user: { id: this.currentUserId },
      achievement: { type: "earned", name: VaultItems_10_Added_Achievement.name as AchievementId },
    };

    this.eventStore.addEvent(earnedAchievement);
  }
}
