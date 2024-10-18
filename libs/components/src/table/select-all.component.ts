import { Component } from "@angular/core";

import { SelectableTableDataSource } from "./selectable-table-data-source";
import { TableComponent } from "./table.component";

@Component({
  selector: "th[bitSelectAll]",
  template: `
    <input
      type="checkbox"
      bitCheckbox
      [checked]="selectionModel.selected.length > 0"
      [indeterminate]="
        selectionModel.selected.length > 0 &&
        selectionModel.selected.length < table.dataSource.data.length
      "
      (change)="toggleSelectAll($any($event.target).checked)"
    />
  `,
})
export class SelectAllComponent {
  protected selectAll = false;

  get selectionModel() {
    if (!(this.table.dataSource instanceof SelectableTableDataSource)) {
      throw new Error("You must use SelectableTableDataSource.");
    }

    return this.table.dataSource.selection;
  }

  constructor(protected table: TableComponent) {}

  protected toggleSelectAll(value: boolean) {
    this.selectAll = value;

    if (value) {
      this.selectionModel.setSelection(...this.table.dataSource.filteredData);
    } else {
      this.selectionModel.clear();
    }
  }
}
