import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-landing-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    class: "tw-flex tw-flex-col tw-flex-1",
  },
})
export class LandingContentComponent {}
