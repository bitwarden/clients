import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "footer[bitLandingFooter]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
})
export class LandingFooterComponent {}
