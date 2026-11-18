import { isDataSource } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  input,
  OnDestroy,
  signal,
  TemplateRef,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./table.component.html",
  imports: [CommonModule],
})
export class TableComponent implements OnDestroy, AfterContentChecked {
  readonly dataSource = input<TableDataSource<any>>();
  readonly layout = input<"auto" | "fixed">("auto");

  readonly templateVariable = contentChild(TableBodyDirective);

  protected readonly rows$ = signal<Observable<any[]> | undefined>(undefined);

  protected readonly tableClass = computed(() => [
    "tw-w-full",
    "tw-leading-normal",
    "tw-text-main",
    "tw-border-collapse",
    "tw-text-start",
    this.layout() === "auto" ? "tw-table-auto" : "tw-table-fixed",
  ]);

  ngAfterContentChecked(): void {
    const dataSource = this.dataSource();
    if (this.rows$() === undefined && isDataSource(dataSource)) {
      this.rows$.set(dataSource.connect());
    }
  }

  ngOnDestroy(): void {
    const dataSource = this.dataSource();
    if (isDataSource(dataSource)) {
      dataSource.disconnect();
    }
  }
}
