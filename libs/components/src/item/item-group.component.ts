import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-item-group",
  imports: [],
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
    role: "list",
  },
})
export class ItemGroupComponent {}
