import { Component } from "@angular/core";

@Component({
  selector: "bit-item-action",
  imports: [],
  template: `<ng-content></ng-content>`,
  host: {
    class:
      /**
       * `top` and `bottom` units should be kept in sync with `item-content.component.ts`'s y-axis padding.
       * we want this `:after` element to be the same height as the `item-content`
       */
      "[&>button]:tw-relative [&>button:not([bit-item-content])]:after:tw-content-[''] [&>button]:after:tw-absolute [&>button]:after:tw-block bit-compact:[&>button]:after:tw-top-[-0.7rem] bit-compact:[&>button]:after:tw-bottom-[-0.7rem] [&>button]:after:tw-top-[-0.8rem] [&>button]:after:tw-bottom-[-0.80rem] [&>button]:after:tw-right-0 [&>button]:after:tw-left-0",
  },
})
export class ItemActionComponent {}
