import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApplicationHealthReportDetailWithCriticalFlag } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { MenuModule, TableDataSource, TableModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  selector: "app-table-row-scrollable",
  standalone: true,
  imports: [CommonModule, JslibModule, TableModule, SharedModule, PipesModule, MenuModule],
  templateUrl: "./app-table-row-scrollable.component.html",
})
export class AppTableRowScrollableComponent {
  @Input() dataSource!: TableDataSource<ApplicationHealthReportDetailWithCriticalFlag>;
  @Input() showRowMenuForCriticalApps: boolean = false;
  @Input() showRowCheckBox: boolean = false;
  @Input() selectedUrls: Set<string> = new Set<string>();
  @Input() isCriticalAppsFeatureEnabled: boolean = false;
  @Input() isDrawerIsOpenForThisRecord!: (applicationName: string) => boolean;
  @Input() showAppAtRiskMembers!: (applicationName: string) => void;
  @Input() unmarkAsCriticalApp!: (applicationName: string) => void;
  @Input() checkboxChange!: (applicationName: string, $event: Event) => void;
}
