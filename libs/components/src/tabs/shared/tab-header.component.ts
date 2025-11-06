import { Component } from "@angular/core";

/**
 * Component used for styling the tab header/background for both content and navigation tabs
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-tab-header",
  host: {
    class:
      "tw-h-16 tw-ps-4 tw-bg-background-alt tw-flex tw-items-end tw-border-0 tw-border-b tw-border-solid tw-border-secondary-100",
  },
  template: `<ng-content></ng-content>`,
})
export class TabHeaderComponent {}
