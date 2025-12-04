import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApplicationHealthReportDetailEnriched } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuModule, TableDataSource, TableModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

export type CipherIcon = CipherViewLike | undefined;

export type ApplicationTableDataSource = ApplicationHealthReportDetailEnriched & {
  iconCipher: CipherIcon;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-table-row-scrollable",
  imports: [CommonModule, JslibModule, TableModule, SharedModule, PipesModule, MenuModule],
  templateUrl: "./app-table-row-scrollable.component.html",
})
export class AppTableRowScrollableComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  dataSource!: TableDataSource<ApplicationTableDataSource>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showRowMenuForCriticalApps: boolean = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showRowCheckBox: boolean = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() selectedUrls: Set<string> = new Set<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() openApplication: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showAppAtRiskMembers!: (applicationName: string) => void;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() unmarkAsCritical!: (applicationName: string) => void;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() checkboxChange!: (applicationName: string, $event: Event) => void;
}
