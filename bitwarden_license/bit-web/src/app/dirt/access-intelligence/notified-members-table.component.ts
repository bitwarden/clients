import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TableDataSource, TableModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-notified-members-table",
  templateUrl: "./notified-members-table.component.html",
  imports: [CommonModule, JslibModule, TableModule],
})
export class NotifiedMembersTableComponent {
  dataSource = new TableDataSource<any>();

  constructor() {
    this.dataSource.data = [];
  }
}
