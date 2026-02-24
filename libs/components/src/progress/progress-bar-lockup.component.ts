import { CommonModule } from "@angular/common";
import { Component, input, ChangeDetectionStrategy } from "@angular/core";

import { TypographyModule } from "../typography";

import { ProgressBarComponent, BackgroundType } from "./progress-bar.component";

/**
 * The progress bar lockup component consumes the progress bar component with illustration, title, and subtitle.
 */
@Component({
  selector: "bit-progress-bar-lockup",
  templateUrl: "./progress-bar-lockup.component.html",
  imports: [CommonModule, ProgressBarComponent, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarLockupComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly variant = input<BackgroundType>("primary");
  readonly label = input<string>();
  readonly barWidth = input<number>(0);
  readonly startText = input<string>();
  readonly endText = input<string>();
}
