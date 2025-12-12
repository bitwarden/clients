import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "[bitLandingContent]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    class: "tw-flex tw-flex-col tw-flex-1",
  },
})
export class LandingContentComponent {}
