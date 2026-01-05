import { isDataSource } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  Component,
  Directive,
  OnDestroy,
  TemplateRef,
  input,
  contentChild,
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-table",
  templateUrl: "./table.component.html",
  imports: [CommonModule],
})
export class TableComponent implements OnDestroy, AfterContentChecked {
  readonly dataSource = input<TableDataSource<any>>();
  readonly layout = input<"auto" | "fixed">("auto");

  readonly templateVariable = contentChild(TableBodyDirective);

  protected rows$?: Observable<any[]>;

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
