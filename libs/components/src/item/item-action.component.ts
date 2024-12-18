import { Component } from "@angular/core";

import { A11yCellDirective } from "../a11y/a11y-cell.directive";

@Component({
  selector: "bit-item-action",
  standalone: true,
  imports: [],
  template: `<ng-content></ng-content>`,
  providers: [{ provide: A11yCellDirective, useExisting: ItemActionComponent }],
  host: {
    class:
      "[&>button]:tw-relative [&>button:not([bit-item-content])]:before:tw-content-[''] [&>button]:before:tw-absolute [&>button]:before:tw-block [&>button]:before:tw-top-[-0.75rem] [&>button]:before:tw-bottom-[-0.75rem] [&>button]:before:tw-right-[-0.25rem] [&>button]:before:tw-left-[-0.25rem]",
  },
})
export class ItemActionComponent extends A11yCellDirective {}
