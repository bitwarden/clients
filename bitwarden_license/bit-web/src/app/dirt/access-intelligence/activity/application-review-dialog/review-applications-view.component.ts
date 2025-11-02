import { CommonModule } from "@angular/common";
import { Component, input, output, ChangeDetectionStrategy } from "@angular/core";

import { ButtonModule, DialogModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-review-applications-view",
  templateUrl: "./review-applications-view.component.html",
  imports: [CommonModule, ButtonModule, DialogModule, TypographyModule, I18nPipe],
})
export class ReviewApplicationsViewComponent {
  readonly applications = input.required<string[]>();
  readonly selectedApplications = input.required<Set<string>>();

  // Return the selected applications from the view
  onToggleSelection = output<string>();

  toggleSelection(applicationName: string): void {
    this.onToggleSelection.emit(applicationName);
  }
}
