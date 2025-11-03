import { CommonModule } from "@angular/common";
import { Component, input, output, ChangeDetectionStrategy, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ApplicationHealthReportDetail } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { ButtonModule, DialogModule, SearchModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-review-applications-view",
  templateUrl: "./review-applications-view.component.html",
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    FormsModule,
    SearchModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class ReviewApplicationsViewComponent {
  readonly applications = input.required<ApplicationHealthReportDetail[]>();
  readonly selectedApplications = input.required<Set<string>>();

  protected readonly searchText = signal<string>("");

  // Filter applications based on search text
  protected readonly filteredApplications = computed(() => {
    const search = this.searchText().toLowerCase();
    if (!search) {
      return this.applications();
    }
    return this.applications().filter((app) => app.applicationName.toLowerCase().includes(search));
  });

  // Return the selected applications from the view
  onToggleSelection = output<string>();
  onToggleAll = output<void>();

  toggleSelection(applicationName: string): void {
    this.onToggleSelection.emit(applicationName);
  }

  toggleAll(): void {
    this.onToggleAll.emit();
  }

  isAllSelected(): boolean {
    const filtered = this.filteredApplications();
    return (
      filtered.length > 0 &&
      filtered.every((app) => this.selectedApplications().has(app.applicationName))
    );
  }

  onSearchTextChanged(searchText: string): void {
    this.searchText.set(searchText);
  }
}
