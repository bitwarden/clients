import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/password-health";
import { MenuModule, TableDataSource, TableModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  selector: "app-table-row-scrollable",
  imports: [CommonModule, JslibModule, TableModule, SharedModule, PipesModule, MenuModule],
  templateUrl: "./app-table-row-scrollable.component.html",
})
export class AppTableRowScrollableComponent {
  @Input()
  dataSource!: TableDataSource<LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher>;
  @Input() showRowMenuForCriticalApps: boolean = false;
  @Input() showRowCheckBox: boolean = false;
  @Input() selectedUrls: Set<string> = new Set<string>();
  @Input() openApplication: string = "";
  @Input() showAppAtRiskMembers!: (applicationName: string) => void;
  @Input() unmarkAsCritical!: (applicationName: string) => void;
  @Input() checkboxChange!: (applicationName: string, $event: Event) => void;
}
