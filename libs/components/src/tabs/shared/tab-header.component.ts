import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Component used for styling the tab header/background for both content and navigation tabs
 */
@Component({
  selector: "bit-tab-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-items-end tw-border-0 tw-border-b tw-border-solid tw-border-border-base",
  },
  template: `<ng-content></ng-content>`,
})
export class TabHeaderComponent {}
