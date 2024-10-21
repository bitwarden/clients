import { isDataSource } from "@angular/cdk/collections";
import {
  AfterContentChecked,
  Component,
  ContentChild,
  Directive,
  Input,
  OnDestroy,
  TemplateRef,
} from "@angular/core";
import { Observable } from "rxjs";

import { SelectableTableDataSource } from "./selectable-table-data-source";
import { TableDataSource } from "./table-data-source";

@Directive({
  selector: "ng-template[body]",
})
export class TableBodyDirective {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(public readonly template: TemplateRef<any>) {}
}

@Component({
  selector: "bit-table",
  templateUrl: "./table.component.html",
})
export class TableComponent implements OnDestroy, AfterContentChecked {
  @Input() dataSource: TableDataSource<any> | SelectableTableDataSource<any>;
  @Input() layout: "auto" | "fixed" = "auto";

  @ContentChild(TableBodyDirective) templateVariable: TableBodyDirective;

  protected rows: Observable<readonly any[]>;

  private _initialized = false;

  get tableClass() {
    return [
      "tw-w-full",
      "tw-leading-normal",
      "tw-text-main",
      "tw-border-collapse",
      "tw-text-start",
      this.layout === "auto" ? "tw-table-auto" : "tw-table-fixed",
    ];
  }

  ngAfterContentChecked(): void {
    if (!this._initialized && isDataSource(this.dataSource)) {
      this._initialized = true;

      const dataStream = this.dataSource.connect();
      this.rows = dataStream;
    }
  }

  ngOnDestroy(): void {
    if (isDataSource(this.dataSource)) {
      this.dataSource.disconnect();
    }
  }
}
