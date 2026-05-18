import { ChangeDetectionStrategy, Component, OnInit, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { LeasingPolicy } from "@bitwarden/pam";

/**
 * SCAFFOLD ONLY — replace with the real PM-37274 component at demo-workspace integration.
 *
 * Renders a hard-coded read-only display of "Mon-Fri 09:00-18:00 UTC". Serializes to
 * `{ kind: "time_of_day", tz: "UTC", windows: [{ daysOfWeek: [1,2,3,4,5], from: "09:00", to: "18:00" }] }`.
 */
@Component({
  selector: "pam-stub-time-of-day-editor",
  templateUrl: "./stub-time-of-day-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [JslibModule],
})
export class StubTimeOfDayEditorComponent implements OnInit {
  /** Emitted once on init with the hard-coded policy value. */
  readonly policyChange = output<LeasingPolicy>();

  ngOnInit(): void {
    this.policyChange.emit(this.buildPolicy());
  }

  buildPolicy(): LeasingPolicy {
    return {
      kind: "time_of_day",
      tz: "UTC",
      windows: [{ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" }],
    };
  }
}
