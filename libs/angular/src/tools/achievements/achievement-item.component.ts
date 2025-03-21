import { CommonModule } from "@angular/common";
import { Component, effect, input, untracked } from "@angular/core";

import {
  ButtonModule,
  Icon,
  IconModule,
  ItemModule,
  TypographyModule,
} from "@bitwarden/components";

import { AchievementIcon } from "./icons/achievement.icon";

@Component({
  selector: "achievement-item",
  templateUrl: "achievement-item.component.html",
  standalone: true,
  imports: [CommonModule, ItemModule, ButtonModule, IconModule, TypographyModule],
})
export class AchievementItem {
  icon = input<Icon>(AchievementIcon);
  protected iconStyle: string = "tw-grayscale";

  title = input.required<string>();
  description = input.required<string>();

  earned = input<boolean>(false);
  progress = input<number>(0);
  date = input<Date>();

  protected bgColorClass: string = "";
  constructor() {
    effect(() => {
      const earned = this.earned();

      untracked(() => {
        if (earned) {
          this.bgColorClass = "tw-bg-success-100";
          this.iconStyle = "";
        }
      });
    });
  }
}
