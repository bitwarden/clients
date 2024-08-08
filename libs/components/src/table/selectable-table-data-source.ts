import { SelectionModel } from "@angular/cdk/collections";

import { TableDataSource } from "./table-data-source";

export class SelectableTableDataSource<T> extends TableDataSource<T> {
  selection = new SelectionModel(true);
}
