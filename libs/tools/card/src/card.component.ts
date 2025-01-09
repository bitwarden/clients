// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TypographyModule } from "@bitwarden/components";

@Component({
  selector: "tools-card",
  templateUrl: "./card.component.html",
  standalone: true,
  imports: [CommonModule, TypographyModule, JslibModule],
  host: {
    class:
      "tw-box-border tw-bg-background tw-block tw-text-main tw-border-solid tw-border tw-border-secondary-300 tw-border [&:not(bit-layout_*)]:tw-rounded-lg tw-rounded-lg tw-p-6",
  },
})
export class CardComponent {
  /**
   * The title of the card
   */
  @Input() title: string;
  /**
   * The current value of the card as emphasized text
   */
  @Input() value: number;
  /**
   * The maximum value of the card
   */
  @Input() maxValue: number;
}
