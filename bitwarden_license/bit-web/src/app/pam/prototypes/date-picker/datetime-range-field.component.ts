import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";

import { FormFieldModule, InputModule, PopoverModule } from "@bitwarden/components";

import { DateRange, DateRangePickerComponent, EditingEnd } from "./date-range-picker.component";

const dateChipFormat = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

const fullDateTimeAnnounce = (d: Date): string =>
  d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const timeInputValue = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const withTime = (date: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
};

const defaultStart = (): Date => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
};

const defaultEnd = (): Date => {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d;
};

/**
 * The PAM-access datetime range field — "grant access from X at Y to A at B". Four controls, all
 * composed from library primitives: two `bitButton` triggers for the date chips (share one
 * popover-mounted calendar) and two `bit-form-field`-wrapped `bitInput` time inputs.
 *
 * Smart defaults land on today 09:00–17:00 so a same-day business-hours grant is one click away.
 * The date chips' `aria-label` includes the current value so screen-reader users hear "Start
 * date, Monday, October 26, 2026, 9:00 AM" instead of just the field name.
 */
@Component({
  selector: "pam-datetime-range-field",
  templateUrl: "./datetime-range-field.component.html",
  imports: [DateRangePickerComponent, FormFieldModule, InputModule, PopoverModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
})
export class DatetimeRangeFieldComponent {
  protected readonly start = signal<Date>(defaultStart());
  protected readonly end = signal<Date>(defaultEnd());
  protected readonly editing = signal<EditingEnd>("start");
  /** Flipped on when a date chip is clicked so the picker steals focus into its grid. */
  protected readonly pickerOpen = signal<boolean>(false);

  protected readonly startDate = computed(() => this.start());
  protected readonly endDate = computed(() => this.end());

  protected readonly startDateLabel = computed(() => dateChipFormat(this.start()));
  protected readonly endDateLabel = computed(() => dateChipFormat(this.end()));
  protected readonly startTimeValue = computed(() => timeInputValue(this.start()));
  protected readonly endTimeValue = computed(() => timeInputValue(this.end()));

  protected readonly startDateAria = computed(
    () => `Start date, ${fullDateTimeAnnounce(this.start())}. Press Enter to change.`,
  );
  protected readonly endDateAria = computed(
    () => `End date, ${fullDateTimeAnnounce(this.end())}. Press Enter to change.`,
  );

  protected openForStart(): void {
    this.editing.set("start");
    this.pickerOpen.set(true);
  }

  protected openForEnd(): void {
    this.editing.set("end");
    this.pickerOpen.set(true);
  }

  protected onPopoverClosed(): void {
    this.pickerOpen.set(false);
  }

  protected onDatePicked(range: DateRange): void {
    this.start.set(withTime(range.start, timeInputValue(this.start())));
    this.end.set(withTime(range.end, timeInputValue(this.end())));
  }

  protected onStartTimeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.start.set(withTime(this.start(), value));
    }
  }

  protected onEndTimeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.end.set(withTime(this.end(), value));
    }
  }

  /**
   * The date fields look like regular inputs (so the form-field styling applies) but accept no
   * typing — the popover is the only way to pick. Lets through navigation keys so Tab, Enter,
   * Esc, and arrow-driven focus still work.
   */
  protected suppressTyping(event: KeyboardEvent): void {
    const navigationKeys = new Set([
      "Tab",
      "Enter",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ]);
    if (!navigationKeys.has(event.key)) {
      event.preventDefault();
    }
  }
}
