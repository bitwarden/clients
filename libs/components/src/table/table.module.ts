import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { CellDirective } from "./cell.directive";
import { RowSelectorComponent, HeaderRowSelectorComponent } from "./row-selector.component";
import { RowDirective } from "./row.directive";
import { SortableComponent } from "./sortable.component";
import { TableBodyDirective, TableComponent } from "./table.component";

@NgModule({
  imports: [CommonModule, HeaderRowSelectorComponent, RowSelectorComponent],
  declarations: [
    TableComponent,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
  ],
  exports: [
    TableComponent,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
    HeaderRowSelectorComponent,
    RowSelectorComponent,
  ],
})
export class TableModule {}
