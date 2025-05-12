import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TableDataSource, TableModule } from "@bitwarden/components";

@Component({
  standalone: true,
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
