import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ReportEntry } from "../models/report-entry";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-report-list",
  templateUrl: "report-list.component.html",
  standalone: false,
})
export class ReportListComponent {
  readonly reports = input<ReportEntry[]>([]);
}
