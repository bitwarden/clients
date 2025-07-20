// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { isDataSource } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  Component,
  ContentChild,
  Directive,
  OnDestroy,
  TemplateRef,
  input,
} from "@angular/core";
import { Observable } from "rxjs";

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
  imports: [CommonModule],
})
export class TableComponent implements OnDestroy, AfterContentChecked {
  readonly dataSource = input<TableDataSource<any>>();
  readonly layout = input<"auto" | "fixed">("auto");

  @ContentChild(TableBodyDirective) templateVariable: TableBodyDirective;

  protected rows$: Observable<any[]>;

  private _initialized = false;

  get tableClass() {
    return [
      "tw-w-full",
      "tw-leading-normal",
      "tw-text-main",
      "tw-border-collapse",
      "tw-text-start",
      this.layout() === "auto" ? "tw-table-auto" : "tw-table-fixed",
    ];
  }

  ngAfterContentChecked(): void {
    const dataSource = this.dataSource();
    if (!this._initialized && isDataSource(dataSource)) {
      this._initialized = true;

      const dataStream = dataSource.connect();
      this.rows$ = dataStream;
    }
  }

  ngOnDestroy(): void {
    const dataSource = this.dataSource();
    if (isDataSource(dataSource)) {
      dataSource.disconnect();
    }
  }
}
