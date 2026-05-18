import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CalloutModule, FormFieldModule, SelectModule } from "@bitwarden/components";
import { DayOfWeek, TimeWindow } from "@bitwarden/pam";

import { TimeWindowCardComponent } from "./time-window-card.component";

/**
 * IANA timezone list sourced from `Intl.supportedValuesOf("timeZone")` at runtime,
 * falling back to a curated list when the API is not available (older environments).
 *
 * TBD (PM-37274 tech breakdown): expose the org's default timezone from the Organization
 * model so the initial value can be pre-populated. Until that field exists on the server
 * model we default to the browser timezone (or UTC as a last resort).
 */
const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

function getAvailableTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
        "timeZone",
      );
    }
  } catch {
    // Fall through to curated list.
  }
  return FALLBACK_TIMEZONES;
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const DEFAULT_WINDOW: TimeWindow = {
  daysOfWeek: [1, 2, 3, 4, 5] as DayOfWeek[],
  from: "09:00",
  to: "18:00",
};

@Component({
  selector: "pam-time-of-day-editor",
  templateUrl: "./time-of-day-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    ButtonModule,
    CalloutModule,
    FormFieldModule,
    SelectModule,
    TimeWindowCardComponent,
  ],
})
export class TimeOfDayEditorComponent implements OnInit {
  protected readonly i18nService = inject(I18nService);

  /** Pre-loaded timezone for the policy (e.g. from existing server config). */
  readonly initialTz = input<string | null>(null);

  /**
   * Pre-loaded windows for the policy (e.g. from existing server config).
   * When null the editor starts with a single Mon–Fri 09:00–18:00 default.
   */
  readonly initialWindows = input<TimeWindow[] | null>(null);

  /** Whether the form controls should be read-only. */
  readonly disabled = input<boolean>(false);

  /** Emitted whenever the editor value changes (tz or any window). */
  readonly policyChange = output<{ tz: string; windows: TimeWindow[] } | null>();

  protected readonly availableTimezones = getAvailableTimezones();
  protected readonly timezoneOptions = this.availableTimezones.map((tz) => ({
    value: tz,
    label: tz,
  }));

  protected readonly tz = signal<string>(getBrowserTimezone());
  protected readonly windows = signal<TimeWindow[]>([{ ...DEFAULT_WINDOW }]);

  protected readonly isValid = computed(() => {
    const wins = this.windows();
    if (wins.length === 0) {
      return false;
    }
    return wins.every(
      (w) => w.daysOfWeek.length > 0 && w.from.length > 0 && w.to.length > 0 && w.from < w.to,
    );
  });

  ngOnInit(): void {
    const initial = this.initialTz();
    if (initial) {
      this.tz.set(initial);
    }
    const initialWins = this.initialWindows();
    if (initialWins && initialWins.length > 0) {
      this.windows.set(initialWins);
    }
    this.emit();
  }

  protected onTzChange(tz: string): void {
    this.tz.set(tz);
    this.emit();
  }

  protected onWindowChange(index: number, updated: TimeWindow): void {
    this.windows.update((ws) => {
      const next = [...ws];
      next[index] = updated;
      return next;
    });
    this.emit();
  }

  protected addWindow(): void {
    this.windows.update((ws) => [...ws, { ...DEFAULT_WINDOW }]);
    this.emit();
  }

  protected removeWindow(index: number): void {
    this.windows.update((ws) => ws.filter((_, i) => i !== index));
    this.emit();
  }

  private emit(): void {
    if (!this.isValid()) {
      this.policyChange.emit(null);
      return;
    }
    this.policyChange.emit({ tz: this.tz(), windows: this.windows() });
  }
}
