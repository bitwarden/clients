import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

@Component({
  selector: "app-risk-insights-prototype-members",
  templateUrl: "./risk-insights-prototype-members.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeMembersComponent {}
