import {
  AfterViewInit,
  ContentChildren,
  Directive,
  HostBinding,
  QueryList,
  ViewChildren,
} from "@angular/core";

import { A11yCellDirective } from "./a11y-cell.directive";

@Directive({
  selector: "bitA11yRow",
  standalone: true,
})
export class A11yRowDirective implements AfterViewInit {
  @HostBinding("attr.role")
  role = "row";

  cells: A11yCellDirective[];

  @ViewChildren(A11yCellDirective)
  private viewCells: QueryList<A11yCellDirective>;

  @ContentChildren(A11yCellDirective)
  private contentCells: QueryList<A11yCellDirective>;

  ngAfterViewInit(): void {
    this.cells = [...this.viewCells, ...this.contentCells];
  }
}
