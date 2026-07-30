import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-risk-insights-loading",
  imports: [CommonModule, JslibModule],
  templateUrl: "./risk-insights-loading.component.html",
})
export class ApplicationsLoadingComponent {
  constructor() {}
}
