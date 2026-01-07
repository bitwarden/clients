// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { ReportEntry } from "../models/report-entry";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-report-list",
  templateUrl: "report-list.component.html",
  standalone: false,
})
export class ReportListComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() reports: ReportEntry[];
}
