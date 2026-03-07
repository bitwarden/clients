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

import { ApplicationHealthReportDetail } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  ButtonModule,
  DialogModule,
  SearchModule,
  TypographyModule,
  IconComponent,
  TableDataSource,
  ScrollLayoutHostDirective,
  Sort,
  ScrollLayoutService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { CipherIcon } from "../../shared/app-table-row-scrollable.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-review-applications-view",
  templateUrl: "./review-applications-view.component.html",
  providers: [ScrollLayoutService], // need a local instance of ScrollLayoutService for the scrollable table
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    FormsModule,
    SearchModule,
    TypographyModule,
    I18nPipe,
    SharedModule,
    IconComponent,
    ScrollLayoutHostDirective,
  ],
})
export class ReviewApplicationsViewComponent {
  readonly applications =
    input.required<Array<ApplicationHealthReportDetail & { iconCipher: CipherIcon }>>();
  readonly selectedApplications = input.required<Set<string>>();

  protected readonly searchText = signal<string>("");

  protected readonly dataSource = new TableDataSource<
    ApplicationHealthReportDetail & { iconCipher: CipherIcon }
  >();

  // Filter applications based on search text (pure computation)
  protected readonly filteredApplications = computed(() => {
    const search = this.searchText().toLowerCase();
    let data = this.applications();

    if (search) {
      data = this.applications().filter((app) =>
        app.applicationName.toLowerCase().includes(search),
      );
    }

    return data;
  });

  constructor() {
    effect(() => {
      // update the TableDataSource with the results of the filtered applications
      this.dataSource.data = this.filteredApplications();
      this.dataSource.sort = { column: "atRiskPasswordCount", direction: "desc" } as Sort;
    });
  }

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
