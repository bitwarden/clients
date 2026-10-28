import { CommonModule } from "@angular/common";
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { ApplicationHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import {
  BitIconButtonComponent,
  DialogModule,
  IconComponent,
  ScrollLayoutHostDirective,
  ScrollLayoutService,
  SearchModule,
  TableDataSource,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Displays a searchable, selectable list of applications with health metrics
 * for reviewing newly detected applications in an Access Intelligence report.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-review-applications-view-v2",
  standalone: true,
  templateUrl: "./review-applications-view-v2.component.html",
  providers: [ScrollLayoutService],
  imports: [
    AppVaultIconComponent,
    BitIconButtonComponent,
    CommonModule,
    DialogModule,
    FormsModule,
    I18nPipe,
    IconComponent,
    ScrollLayoutHostDirective,
    SearchModule,
    TableModule,
    TypographyModule,
  ],
})
export class ReviewApplicationsViewV2Component {
  /**
   * Applications to display (new applications with health data)
   */
  readonly applications = input.required<ApplicationHealthView[]>();

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
   * Data source for the virtual-scroll table.
   * Populated by the constructor effect whenever filteredApplications changes.
   */
  protected readonly dataSource = new TableDataSource<ApplicationHealthView>();

  /**
   * Emitted when user toggles selection of a single application
   */
  readonly onToggleSelection = output<string>();

  /**
   * Emitted when user toggles "select all" button
   */
  readonly onToggleAll = output<void>();

  constructor() {
    effect(() => {
      this.dataSource.data = this.filteredApplications();
    });
  }

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
}
