import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { MenuModule, TableDataSource, TableModule, TooltipDirective } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

/**
 * V2 Application Table Row Data
 *
 * Simple type that works directly with V2 models (ApplicationHealthView + AccessReportSettingsView).
 * No dependency on V1 ApplicationHealthReportDetail types.
 */
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
 * Displays a virtualized, scrollable table of applications with at-risk password
 * and member counts, critical badges, and per-row actions.
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
  readonly selectedUrls = input.required<Set<string>>();
  readonly openApplication = input<string>("");
  readonly showAppAtRiskMembers = output<string>();
  readonly checkboxChange = output<{ applicationName: string; checked: boolean }>();
  readonly selectAllChange = output<boolean>();

  protected emitCheckboxChange(applicationName: string, event: Event): void {
    this.checkboxChange.emit({
      applicationName,
      checked: (event.target as HTMLInputElement).checked,
    });
  }

  allAppsSelected(): boolean {
    const tableData = this.dataSource().filteredData;
    const selectedUrls = this.selectedUrls();

    if (!tableData) {
      return false;
    }

    return tableData.length > 0 && tableData.every((row) => selectedUrls.has(row.applicationName));
  }

  selectAllChanged(target: HTMLInputElement) {
    this.selectAllChange.emit(target.checked);
  }
}
