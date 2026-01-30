import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MenuModule, TableDataSource, TableModule, TooltipDirective } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { ApplicationTableDataSource } from "./app-table-row-scrollable.component";

//TODO: Rename this component to AppTableRowScrollableComponent once milestone 11 is fully rolled out
//TODO: Move definition of ApplicationTableDataSource to this file from app-table-row-scrollable.component.ts

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-table-row-scrollable-m11",
  imports: [
    CommonModule,
    JslibModule,
    TableModule,
    SharedModule,
    PipesModule,
    MenuModule,
    TooltipDirective,
  ],
  templateUrl: "./app-table-row-scrollable-m11.component.html",
})
export class AppTableRowScrollableM11Component {
  readonly dataSource = input<TableDataSource<ApplicationTableDataSource>>();
  readonly showRowMenuForCriticalApps = input<boolean>(false);
  readonly selectedUrls = input<Set<string>>();
  readonly openApplication = input<string>("");
  readonly showAppAtRiskMembers = input<(applicationName: string) => void>();
  readonly checkboxChange = input<(applicationName: string, $event: Event) => void>();

  allAppsSelected(): boolean {
    return (
      this.dataSource().filteredData?.length > 0 &&
      this.dataSource().filteredData?.every((row) => this.selectedUrls().has(row.applicationName))
    );
  }

  selectAllChanged(target: HTMLInputElement) {
    const checked = target.checked;

    if (checked) {
      this.dataSource().filteredData.forEach((row) => this.selectedUrls().add(row.applicationName));
    } else {
      this.selectedUrls().clear();
    }
  }
}
