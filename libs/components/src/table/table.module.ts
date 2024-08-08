import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { CheckboxModule } from "../checkbox";

import { CellDirective } from "./cell.directive";
import { RowDirective } from "./row.directive";
import { SelectAllComponent } from "./select-all.component";
import { SelectRowComponent } from "./select-row.component";
import { SortableComponent } from "./sortable.component";
import { TableBodyDirective, TableComponent } from "./table.component";

@NgModule({
  imports: [CommonModule, CheckboxModule],
  declarations: [
    TableComponent,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
    SelectRowComponent,
    SelectAllComponent,
  ],
  exports: [
    TableComponent,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
    SelectRowComponent,
    SelectAllComponent,
  ],
})
export class TableModule {}
