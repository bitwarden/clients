import { Component, Input } from "@angular/core";

import { TableComponent } from "./table.component";

@Component({
  selector: "td[bitSelectRow]",
  template: `
    <input
      type="checkbox"
      bitCheckbox
      [checked]="table.dataSource.selection.getValue(row)"
      (change)="table.dataSource.selection.setValue(row, $any($event.target).checked)"
      *ngIf="table.dataSource.selection.canSelect(row)"
    />
  `,
})
export class SelectRowComponent<T> {
  protected row: T;

  @Input() set bitSelectRow(value: T) {
    this.row = value;
  }

  constructor(protected table: TableComponent) {}
}
