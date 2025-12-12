import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "header[bitLandingHeader]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
})
export class LandingHeaderComponent {}
