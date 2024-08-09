import { SelectionModel, isDataSource } from "@angular/cdk/collections";
import {
  AfterContentChecked,
  Component,
  ContentChild,
  Directive,
  Input,
  OnDestroy,
  TemplateRef,
} from "@angular/core";
import { Observable, Subject, takeUntil } from "rxjs";

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
  @Input() dataSource: TableDataSource<any>;
  @Input() layout: "auto" | "fixed" = "auto";
  @Input() selectionModel: SelectionModel<any>;

  @ContentChild(TableBodyDirective) templateVariable: TableBodyDirective;

  protected rows: Observable<readonly any[]>;

  private _initialized = false;
  private _destroy$ = new Subject<void>();

  get tableClass() {
    return [
      "tw-w-full",
      "tw-h-fit",
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

      if (this.selectionModel) {
        dataStream.pipe(takeUntil(this._destroy$)).subscribe(() => {
          this.selectionModel.clear();
        });
      }
    }
  }

  ngOnDestroy(): void {
    if (isDataSource(this.dataSource)) {
      this.dataSource.disconnect();
    }

    this._destroy$.next();
    this._destroy$.complete();
  }
}
