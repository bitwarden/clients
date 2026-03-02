import { CommonModule } from "@angular/common";
import { Component, input, ChangeDetectionStrategy, contentChild, AfterViewInit } from "@angular/core";

import { TypographyModule } from "../typography";

import { ProgressBarComponent } from "./progress-bar.component";

/**
 * The progress bar lockup component consumes the progress bar component with illustration, title, and subtitle.
 */
@Component({
  selector: "bit-progress-bar-lockup",
  templateUrl: "./progress-bar-lockup.component.html",
  imports: [CommonModule, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarLockupComponent implements AfterViewInit {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  private readonly progressBar = contentChild.required(ProgressBarComponent);

  ngAfterViewInit() {
    if (!this.progressBar()) {
      // This is only here so Angular throws a compilation error if no progress bar is provided.
      // the `this.progressBar()` value must try to be accessed for the required content child check to throw
      // eslint-disable-next-line no-console
      console.error(
        "No progress bar component provided. <bit-progress-bar-lockup> must be used with a <bit-progress-bar>.",
      );
    }
  }
}
