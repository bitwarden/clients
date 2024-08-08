import { Component, Input } from "@angular/core";

import { SelectableTableDataSource } from "./selectable-table-data-source";
import { TableComponent } from "./table.component";

@Component({
  selector: "td[bitSelectRow]",
  template: `
    <input
      type="checkbox"
      bitCheckbox
      [checked]="selectionModel.isSelected(row)"
      (change)="selectionModel.toggle(row)"
    />
  `,
})
export class SelectRowComponent<T> {
  protected row: T;

  @Input() set bitSelectRow(value: T) {
    this.row = value;
  }

  get selectionModel() {
    if (!(this.table.dataSource instanceof SelectableTableDataSource)) {
      throw new Error("You must use SelectableTableDataSource.");
    }

    return this.table.dataSource.selection;
  }

  constructor(protected table: TableComponent) {}
}
