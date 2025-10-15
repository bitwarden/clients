import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

@Component({
  selector: "dirt-risk-insights-loading",
  imports: [CommonModule, JslibModule],
  templateUrl: "./risk-insights-loading.component.html",
})
export class ApplicationsLoadingComponent {
  constructor() {}
}
