import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AchievementsListComponent } from "@bitwarden/angular/tools/achievements/achievements-list.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventStoreAbstraction } from "@bitwarden/common/tools/achievements/event-store.abstraction.service";
import { VaultItems_10_Added_Achievement } from "@bitwarden/common/tools/achievements/examples/achievements";
import { AchievementEarnedEvent, AchievementId } from "@bitwarden/common/tools/achievements/types";
import { UserId } from "@bitwarden/common/types/guid";
import { ButtonModule, IconModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "achievements.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
    ButtonModule,
    IconModule,
    AchievementsListComponent,
  ],
})
export class AchievementsComponent implements OnInit {
  private currentUserId: UserId;

  constructor(
    private eventStore: EventStoreAbstraction,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
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
