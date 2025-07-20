import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-card",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "tw-box-border tw-block tw-bg-background tw-text-main tw-border-solid tw-border-b tw-border-0 tw-border-b-secondary-300 [&:not(bit-layout_*)]:tw-rounded-lg [&:not(bit-layout_*)]:tw-border-b-shadow tw-py-4 bit-compact:tw-py-3 tw-px-3 bit-compact:tw-px-2",
  },
})
export class CardComponent {}
