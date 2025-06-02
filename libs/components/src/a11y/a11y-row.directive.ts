import {
  Directive,
  HostBinding,
  Signal,
  computed,
  contentChildren,
  viewChildren,
} from "@angular/core";

import { A11yCellDirective } from "./a11y-cell.directive";

@Directive({
  selector: "[bitA11yRow]",
  standalone: true,
})
export class A11yRowDirective {
  @HostBinding("attr.role")
  role?: "row" | null;

  private viewCells = viewChildren(A11yCellDirective);
  private contentCells = contentChildren(A11yCellDirective);

  cells: Signal<A11yCellDirective[]> = computed(() => [
    ...this.viewCells(),
    ...this.contentCells(),
  ]);
}
