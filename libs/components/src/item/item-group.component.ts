import { ChangeDetectionStrategy, Component } from "@angular/core";

import { A11yGridDirective } from "../a11y/a11y-grid.directive";

@Component({
  selector: "bit-item-group",
  standalone: true,
  imports: [],
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
  hostDirectives: [A11yGridDirective],
})
export class ItemGroupComponent {}
