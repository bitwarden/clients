import { CommonModule } from "@angular/common";
import { Component, input, output, ChangeDetectionStrategy, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { RiskInsightsReportView } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/view/risk-insights-report.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule, DialogModule, SearchModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

/**
 * ReviewApplicationsViewV2Component - V2 subcomponent for new applications review dialog
 *
 * Displays a searchable, selectable table of new applications with health metrics.
 * Works directly with V2 models (RiskInsightsReportView).
 *
 * Key V2 patterns:
 * - Uses RiskInsightsReportView instead of ApplicationHealthReportDetail
 * - OnPush change detection
 * - Signal inputs/outputs
 * - Standalone component
 * - Uses report.getIconCipherId() for efficient icon lookups
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-review-applications-view-v2",
  standalone: true,
  templateUrl: "./review-applications-view-v2.component.html",
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    FormsModule,
    SearchModule,
    TypographyModule,
    I18nPipe,
    SharedModule,
  ],
})
export class ReviewApplicationsViewV2Component {
  /**
   * Applications to display (new applications with health data)
   */
  readonly applications = input.required<RiskInsightsReportView[]>();

  /**
   * Ciphers for icon lookup
   */
  readonly ciphers = input.required<CipherView[]>();

  /**
   * Currently selected application names
   */
  readonly selectedApplications = input.required<Set<string>>();

  /**
   * Current search text (local state)
   */
  protected readonly searchText = signal<string>("");

  /**
   * Filtered applications based on search text
   */
  protected readonly filteredApplications = computed(() => {
    const search = this.searchText().toLowerCase();
    if (!search) {
      return this.applications();
    }
    return this.applications().filter((app) => app.applicationName.toLowerCase().includes(search));
  });

  /**
   * Emitted when user toggles selection of a single application
   */
  onToggleSelection = output<string>();

  /**
   * Emitted when user toggles "select all" button
   */
  onToggleAll = output<void>();

  /**
   * Toggle selection state of a single application
   */
  toggleSelection(applicationName: string): void {
    this.onToggleSelection.emit(applicationName);
  }

  /**
   * Toggle "select all" state
   */
  toggleAll(): void {
    this.onToggleAll.emit();
  }

  /**
   * Check if all filtered applications are selected
   */
  isAllSelected(): boolean {
    const filtered = this.filteredApplications();
    return (
      filtered.length > 0 &&
      filtered.every((app) => this.selectedApplications().has(app.applicationName))
    );
  }

  /**
   * Update search text when user types in search box
   */
  onSearchTextChanged(searchText: string): void {
    this.searchText.set(searchText);
  }

  /**
   * Get the cipher to use for icon display for a given application report
   *
   * Uses the pre-computed icon cipher ID from the report for efficient lookup.
   */
  getIconCipher(app: RiskInsightsReportView): CipherView | undefined {
    const iconCipherId = app.getIconCipherId();
    return iconCipherId ? this.ciphers().find((c) => c.id === iconCipherId) : undefined;
  }
}
