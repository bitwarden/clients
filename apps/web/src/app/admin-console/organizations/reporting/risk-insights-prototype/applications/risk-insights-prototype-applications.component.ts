import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

@Component({
  selector: "app-risk-insights-prototype-applications",
  templateUrl: "./risk-insights-prototype-applications.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeApplicationsComponent {}
