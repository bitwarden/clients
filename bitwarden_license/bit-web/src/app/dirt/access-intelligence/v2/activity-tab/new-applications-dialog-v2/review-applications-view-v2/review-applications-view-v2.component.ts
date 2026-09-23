import { CommonModule } from "@angular/common";
import { Component, input, output, ChangeDetectionStrategy, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ApplicationHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule, DialogModule, SearchModule, TypographyModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

/**
 * Displays a searchable, selectable list of applications with health metrics
 * for reviewing newly detected applications in an Access Intelligence report.
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
    SharedModule,
  ],
})
export class ReviewApplicationsViewV2Component {
  /**
   * Applications to display (new applications with health data)
   */
  readonly applications = input.required<ApplicationHealthView[]>();

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
   * Map of cipher ID → CipherView for O(1) icon lookup
   */
  private readonly cipherMap = computed(() => new Map(this.ciphers().map((c) => [c.id, c])));

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
  readonly onToggleSelection = output<string>();

  /**
   * Emitted when user toggles "select all" button
   */
  readonly onToggleAll = output<void>();

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
   */
  getIconCipher(app: ApplicationHealthView): CipherView | undefined {
    const iconCipherId = app.getIconCipherId();
    return iconCipherId ? this.cipherMap().get(iconCipherId) : undefined;
  }
}
