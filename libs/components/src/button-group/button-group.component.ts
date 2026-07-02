import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-button-group",
  templateUrl: "./button-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-wrap tw-gap-3",
  },
})
export class ButtonGroupComponent {}
