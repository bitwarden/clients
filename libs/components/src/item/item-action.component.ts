import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-item-action",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content></ng-content>`,
  host: {
    class: "[&>button]:tw-relative",
  },
})
export class ItemActionComponent {}
