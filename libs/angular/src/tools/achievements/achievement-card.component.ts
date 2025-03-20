import { CommonModule } from "@angular/common";
import { Component, effect, input, untracked } from "@angular/core";

import {
  ButtonModule,
  CardComponent,
  Icon,
  IconModule,
  ItemModule,
  TypographyModule,
} from "@bitwarden/components";

import { AchievementIcon } from "./achievement-icon";
import { NotAchievedIcon } from "./not-achieved-icon";

@Component({
  selector: "achievement-card",
  templateUrl: "achievement-card.component.html",
  standalone: true,
  imports: [CommonModule, ItemModule, ButtonModule, IconModule, TypographyModule, CardComponent],
})
export class AchievementCard {
  protected icon: Icon = NotAchievedIcon;

  title = input.required<string>();
  description = input.required<string>();

  earned = input<boolean>(false);
  progress = input<number>(0);
  date = input<Date>();

  protected cardClass: string;
  constructor() {
    effect(() => {
      const earned = this.earned();
      const progress = this.progress();

      untracked(() => {
        if (earned) {
          this.icon = AchievementIcon;
          this.cardClass = "tw-bg-success-100";
        } else if (progress > 0) {
          this.icon = AchievementIcon;
          this.cardClass = "tw-bg-info-100";
        } else {
          this.icon = NotAchievedIcon;
          this.cardClass = "";
        }
      });
    });
  }
}
