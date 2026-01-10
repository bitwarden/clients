import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { CellDirective } from "./cell.directive";
import { RowDirective } from "./row.directive";
import { SortableComponent } from "./sortable.component";
import { BitRowDefDirective, TableScrollComponent } from "./table-scroll.component";
import { TableBodyDirective, TableComponent } from "./table.component";

@NgModule({
  imports: [
    CommonModule,
    ScrollingModule,
    BitRowDefDirective,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
    TableComponent,
    TableScrollComponent,
  ],
  exports: [
    BitRowDefDirective,
    CellDirective,
    RowDirective,
    SortableComponent,
    TableBodyDirective,
    TableComponent,
    TableScrollComponent,
  ],
})
export class TableModule {}
