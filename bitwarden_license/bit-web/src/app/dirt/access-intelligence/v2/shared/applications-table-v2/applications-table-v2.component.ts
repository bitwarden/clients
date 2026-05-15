import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { MenuModule, TableDataSource, TableModule, TooltipDirective } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

/** Row data for a single application entry in the applications table. */
export type ApplicationTableRowV2 = {
  applicationName: string;
  atRiskPasswordCount: number;
  passwordCount: number;
  atRiskMemberCount: number;
  memberCount: number;
  isMarkedAsCritical: boolean;
  iconCipher?: CipherView;
};

/**
 * Displays a table of applications with at-risk password and member counts,
 * critical badges, and per-row actions.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-applications-table-v2",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    TableModule,
    SharedModule,
    PipesModule,
    MenuModule,
    TooltipDirective,
  ],
  templateUrl: "./applications-table-v2.component.html",
})
export class ApplicationsTableV2Component {
  readonly dataSource = input.required<TableDataSource<ApplicationTableRowV2>>();
  readonly selectedUrls = input<Set<string>>(new Set());
  readonly openApplication = input<string>("");
  /** When true, shows the critical badge on app name and always uses checkboxes (combined tab). */
  readonly showCriticalBadge = input<boolean>(false);
  /**
   * When provided, shows the unmark-as-critical row menu and hides checkboxes and select-all (critical tab).
   * Called with the application name when the user selects "Unmark as critical".
   */
  readonly onUnmarkAsCritical = input<(appName: string) => void>();
  readonly showAppAtRiskMembers = output<string>();
  readonly checkboxChange = output<{ applicationName: string; checked: boolean }>();
  readonly selectAllChange = output<boolean>();

  protected emitCheckboxChange(applicationName: string, event: Event): void {
    this.checkboxChange.emit({
      applicationName,
      checked: (event.target as HTMLInputElement).checked,
    });
  }

  readonly allAppsSelected = computed(() => {
    const tableData = this.dataSource().filteredData;
    const selectedUrls = this.selectedUrls();

    if (!tableData) {
      return false;
    }

    return tableData.length > 0 && tableData.every((row) => selectedUrls.has(row.applicationName));
  });

  selectAllChanged(target: HTMLInputElement) {
    this.selectAllChange.emit(target.checked);
  }

  /** Returns true when the row should show a star icon instead of a checkbox. */
  protected showStar(isMarkedAsCritical: boolean): boolean {
    return !!this.onUnmarkAsCritical() || (!this.showCriticalBadge() && isMarkedAsCritical);
  }

  /** Returns true when the row should show a checkbox. */
  protected showCheckbox(isMarkedAsCritical: boolean): boolean {
    return !this.onUnmarkAsCritical() && (this.showCriticalBadge() || !isMarkedAsCritical);
  }
}
