import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, contentChild, AfterViewInit } from "@angular/core";

import { TypographyModule } from "../typography";

import { ProgressBarComponent } from "./progress-bar.component";

/**
 * The progress bar lockup component consumes the progress bar component with illustration, title, and description.
 */
@Component({
  selector: "bit-progress-bar-lockup",
  templateUrl: "./progress-bar-lockup.component.html",
  imports: [CommonModule, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarLockupComponent implements AfterViewInit {
  private readonly progressBar = contentChild.required(ProgressBarComponent);

  ngAfterViewInit() {
    // Access the required content child signal to trigger Angular's runtime validation.
    // If no <bit-progress-bar> is projected, Angular throws a runtime error.
    this.progressBar();
  }
}
