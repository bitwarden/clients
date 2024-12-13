import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-item-group",
  standalone: true,
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
})
export class ItemGroupComponent {}
