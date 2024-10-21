import { Directive, HostBinding, Input } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Directive({
  selector: "tr[bitRow]",
})
export class RowDirective {
  /**
   * Data used for row selection.
   */
  @Input("bitRow")
  set rowData(value: unknown) {
    this._rowData$.next(value);
  }
  get rowData(): unknown {
    return this._rowData$.value;
  }
  private _rowData$ = new BehaviorSubject<unknown>(null);
  rowData$ = this._rowData$.asObservable();

  @Input() alignContent: "top" | "middle" | "bottom" | "baseline" = "middle";

  get alignmentClass(): string {
    switch (this.alignContent) {
      case "top":
        return "tw-align-top";
      case "middle":
        return "tw-align-middle";
      case "bottom":
        return "tw-align-bottom";
      default:
        return "tw-align-baseline";
    }
  }

  @HostBinding("class") get classList() {
    return [
      "tw-border-0",
      "tw-border-b",
      "tw-border-secondary-300",
      "tw-border-solid",
      "hover:tw-bg-background-alt",
      "last:tw-border-0",
      "tw-h-full",
      this.alignmentClass,
    ];
  }
}
