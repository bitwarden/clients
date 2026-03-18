import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApplicationHealthReportDetailEnriched } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuModule, TableDataSource, TableModule, TooltipDirective } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

export type CipherIcon = CipherViewLike | undefined;

export type ApplicationTableDataSource = ApplicationHealthReportDetailEnriched & {
  iconCipher: CipherIcon;
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-table-row-scrollable",
  imports: [
    CommonModule,
    JslibModule,
    TableModule,
    SharedModule,
    PipesModule,
    MenuModule,
    TooltipDirective,
  ],
  templateUrl: "./app-table-row-scrollable.component.html",
})
export class AppTableRowScrollableComponent {
  readonly dataSource = input<TableDataSource<ApplicationTableDataSource>>();
  readonly selectedUrls = input<Set<string>>();
  readonly openApplication = input<string>("");
  readonly showAppAtRiskMembers = input<(applicationName: string) => void>();
  readonly checkboxChange = output<{ applicationName: string; checked: boolean }>();
  readonly selectAllChange = output<boolean>();

  allAppsSelected(): boolean {
    const tableData = this.dataSource()?.filteredData;
    const selectedUrls = this.selectedUrls();

    if (!tableData || !selectedUrls) {
      return false;
    }

    return tableData.length > 0 && tableData.every((row) => selectedUrls.has(row.applicationName));
  }

  checkboxChanged(target: HTMLInputElement, applicationName: string) {
    const checked = target.checked;
    this.checkboxChange.emit({ applicationName, checked });
  }

  selectAllChanged(target: HTMLInputElement) {
    const checked = target.checked;
    this.selectAllChange.emit(checked);
  }
}
