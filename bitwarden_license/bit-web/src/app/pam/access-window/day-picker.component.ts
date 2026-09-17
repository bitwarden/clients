import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from "@angular/core";

import { IconButtonModule, MenuModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MAX_SCHEDULE_AHEAD_DAYS, toDateValue } from "./access-window";

/** One cell in the month grid. `null` pads the weeks either side of the month. */
type DayCell = { value: string; day: number; label: string; selectable: boolean } | null;

/** Midnight on `date`'s own calendar day. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Months since year zero, so two months compare as plain numbers. */
function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/**
 * A bound narrowed by a caller's, where they supplied one. `Math.max` at the floor and `Math.min`
 * at the ceiling, because a caller's bound narrows the range and never widens it.
 */
function narrowed(bound: Date, toward: Date | null, pick: (a: number, b: number) => number): Date {
  return toward == null ? bound : new Date(pick(bound.getTime(), startOfDay(toward).getTime()));
}

/**
 * A month calendar for choosing one end of an access window.
 *
 * Lives here rather than in `libs/components` on purpose: the component library has no date
 * picker, and adding one is the UI Foundation team's call, not this feature's. Treat this as the
 * shape of the ask — a POC that shows what the request form needs — and not as a library
 * candidate in its current form.
 *
 * Days before today are unselectable because a window that has already started is not a thing the
 * requester can ask for, and days past {@link MAX_SCHEDULE_AHEAD_DAYS} because a request that far
 * out is more likely a typo than an intent.
 *
 * {@link earliest} and {@link latest} narrow that range further, and the To side needs both: an
 * end cannot fall before the start, and it cannot fall past the instant the governing rule's cap
 * runs out. A calendar that let either be picked would be the one control in the picker able to
 * compose a window the server will refuse.
 */
@Component({
  selector: "app-pam-day-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./day-picker.component.html",
  imports: [IconButtonModule, MenuModule, TypographyModule, I18nPipe],
})
export class DayPickerComponent {
  /** The day currently chosen, as `YYYY-MM-DD`. */
  readonly selected = input<string | null>(null);
  /** The clock the floor and the "today" marker are read from. */
  readonly today = input.required<Date>();
  /** Narrows the floor past today — the earliest day the caller will accept. */
  readonly earliest = input<Date | null>(null);
  /** Narrows the ceiling below {@link MAX_SCHEDULE_AHEAD_DAYS} — the last day the caller will accept. */
  readonly latest = input<Date | null>(null);
  /**
   * Any change returns the month on screen to the selected day's.
   *
   * The host bumps this each time the calendar opens, because this component cannot tell: the
   * overlay keeps its view alive between opens, so a requester who paged forward and then
   * dismissed without choosing would meet that month again on the next open.
   */
  readonly resetOn = input<unknown>(null);

  readonly daySelected = output<string>();

  private readonly locale = inject(LOCALE_ID);

  /** The month on screen, which the arrows move independently of the selection. */
  private readonly monthOffset = linkedSignal<unknown, number>({
    source: () => this.resetOn(),
    computation: () => 0,
  });

  private readonly firstOfSelectedMonth = computed(() => {
    const anchor = this.selected() == null ? this.today() : new Date(`${this.selected()}T00:00`);
    const base = Number.isNaN(anchor.getTime()) ? this.today() : anchor;
    return new Date(base.getFullYear(), base.getMonth() + this.monthOffset(), 1);
  });

  private readonly floor = computed(() =>
    narrowed(startOfDay(this.today()), this.earliest(), Math.max),
  );

  private readonly ceiling = computed(() => {
    const today = startOfDay(this.today());
    const affordance = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + MAX_SCHEDULE_AHEAD_DAYS,
    );
    return narrowed(affordance, this.latest(), Math.min);
  });

  // Held apart from the value it formats: construction is the expensive half of the `Intl` API.
  private readonly monthFormat = computed(
    () => new Intl.DateTimeFormat(this.locale, { month: "long", year: "numeric" }),
  );

  protected readonly monthLabel = computed(() =>
    this.monthFormat().format(this.firstOfSelectedMonth()),
  );

  /**
   * Weekday initials in the locale's own script, read off a known week rather than hardcoded.
   *
   * The ORDER is Sunday-first for every locale, which is wrong for most of them — de, fr, es, the
   * Nordics and more open the week on Monday. Deliberately left: this grid is a POC stand-in for
   * a component library date picker (see the class doc), and `Intl.Locale`'s `weekInfo.firstDay`
   * plus a matching change to the padding in {@link weeks} is the fix to make there rather than
   * here.
   */
  protected readonly weekdayLabels = computed(() => {
    const format = new Intl.DateTimeFormat(this.locale, { weekday: "narrow" });
    // 2024-01-07 was a Sunday; the grid below is Sunday-first, so this matches it.
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 7 + i)));
  });

  /** The month laid out as weeks of seven, padded so each row is a full week. */
  protected readonly weeks = computed<DayCell[][]>(() => {
    const first = this.firstOfSelectedMonth();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const floorMs = this.floor().getTime();
    const ceilingMs = this.ceiling().getTime();

    const fullDate = this.fullDateFormat();

    const cells: DayCell[] = Array.from({ length: first.getDay() }, (): DayCell => null);
    for (let day = 1; day <= daysInMonth; day++) {
      const at = new Date(first.getFullYear(), first.getMonth(), day);
      cells.push({
        value: toDateValue(at),
        day,
        // Formatted off the `Date` in hand. Bound as a method, 31 cells re-parsed `value` back
        // into a `Date` every change-detection pass for a label that only moves with the month.
        label: fullDate.format(at),
        selectable: at.getTime() >= floorMs && at.getTime() <= ceilingMs,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  });

  protected readonly todayValue = computed(() => toDateValue(this.today()));

  /** Whether stepping back would leave the month containing today — nothing there is selectable. */
  protected readonly canStepBack = computed(
    () => monthIndex(this.firstOfSelectedMonth()) > monthIndex(this.floor()),
  );

  protected readonly canStepForward = computed(
    () => monthIndex(this.firstOfSelectedMonth()) < monthIndex(this.ceiling()),
  );

  /** Built once per locale rather than per cell: there are 42 cells in a grid. */
  private readonly fullDateFormat = computed(
    () => new Intl.DateTimeFormat(this.locale, { dateStyle: "full" }),
  );

  protected step(months: number): void {
    this.monthOffset.update((offset) => offset + months);
  }

  protected select(cell: DayCell): void {
    if (cell?.selectable) {
      this.monthOffset.set(0);
      this.daySelected.emit(cell.value);
    }
  }
}
