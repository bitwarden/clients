import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AchievementService } from "@bitwarden/common/tools/achievements/achievement.service.abstraction";
import {
  LoginItems_1_Added_Achievement,
  VaultItems_10_Added_Achievement,
  VaultItems_1_Added_Achievement,
  VaultItems_50_Added_Achievement,
} from "@bitwarden/common/tools/achievements/examples/achievements";
import { UserId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { AchievementCard } from "./achievement-card.component";

@Component({
  selector: "achievements-list",
  templateUrl: "achievements-list.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ItemModule,
    ButtonModule,
    IconButtonModule,
    SectionComponent,
    TypographyModule,
    JslibModule,
    SectionHeaderComponent,
    AchievementCard,
  ],
})
export class AchievementsListComponent implements OnInit {
  private currentUserId: UserId;

  //FIXME Should be retrieved from achievementService or possibly AchievementManager
  private allAchievements = [
    VaultItems_1_Added_Achievement,
    VaultItems_10_Added_Achievement,
    VaultItems_50_Added_Achievement,
    LoginItems_1_Added_Achievement,
  ];

  mockAchievements = [
    { ...VaultItems_1_Added_Achievement, earned: false, progress: 0, date: new Date(0) },
    { ...VaultItems_10_Added_Achievement, earned: false, progress: 1, date: new Date(0) },
    { ...VaultItems_50_Added_Achievement, earned: true, progress: 0, date: new Date(0) },
  ];
  //FIXME uses mockedData for AchievmentsList
  allAchievementCards = this.mockAchievements;
  // allAchievementCards = this.allAchievements.map(achievement => { return { ...achievement, earned: true, progress: 0, date: new Date(0) } });

  constructor(
    private achievementService: AchievementService,
    private accountService: AccountService,
  ) {
    //FIXME AchievementProgressEvent is missing an identifier for a specific achievement
    this.achievementService
      .achievementsInProgress$(this.currentUserId)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        this.allAchievementCards.find((a) => a.name === event.achievement.name);
        const index = this.allAchievementCards.findIndex((a) => a.name === event.achievement.name);
        this.allAchievementCards[index].progress = event.achievement.value;
      });
    this.achievementService
      .achievementsEarned$(this.currentUserId)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        const index = this.allAchievementCards.findIndex((a) => a.name === event.achievement.name);
        this.allAchievementCards[index].earned = true;
        this.allAchievementCards[index].date = new Date(event["@timestamp"]);
      });
  }

  async ngOnInit() {
    this.currentUserId = (await firstValueFrom(this.accountService.activeAccount$)).id;
  }
}
