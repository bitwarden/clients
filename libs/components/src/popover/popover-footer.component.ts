import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-popover-footer",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverFooterComponent {}
