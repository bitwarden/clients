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
      /**
       * `top` and `bottom` units should be kept in sync with `item-content.component.ts`'s y-axis padding.
       * we want this `:before` element to be the same height as the `item-content`
       */
      "[&>button]:tw-relative [&>button:not([bit-item-content])]:before:tw-content-[''] [&>button]:before:tw-absolute [&>button]:before:tw-block bit-compact:[&>button]:before:tw-top-[-0.8rem] bit-compact:[&>button]:before:tw-bottom-[-0.8rem] [&>button]:before:tw-top-[-0.85rem] [&>button]:before:tw-bottom-[-0.85rem] [&>button]:before:tw-right-[-0.25rem] [&>button]:before:tw-left-[-0.25rem]",
  },
})
export class ItemActionComponent extends A11yCellDirective {}
