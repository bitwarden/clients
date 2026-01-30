import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MenuModule, TableDataSource, TableModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { ApplicationTableDataSource } from "./app-table-row-scrollable.component";

//TODO: Rename this component to AppTableRowScrollableComponent once milestone 11 is fully rolled out
//TODO: Move definition of ApplicationTableDataSource to this file from app-table-row-scrollable.component.ts

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-table-row-scrollable-m11",
  imports: [CommonModule, JslibModule, TableModule, SharedModule, PipesModule, MenuModule],
  templateUrl: "./app-table-row-scrollable-m11.component.html",
})
export class AppTableRowScrollableM11Component {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  dataSource!: TableDataSource<ApplicationTableDataSource>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showRowMenuForCriticalApps: boolean = false;
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
