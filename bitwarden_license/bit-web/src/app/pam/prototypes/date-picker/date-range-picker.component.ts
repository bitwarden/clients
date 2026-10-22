import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from "@angular/core";

import { IconButtonModule, TypographyModule } from "@bitwarden/components";

export interface DateRange {
  start: Date;
  end: Date;
}

export type EditingEnd = "start" | "end";

const DAYS_OF_WEEK = [
  { short: "S", full: "Sunday" },
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
] as const;

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1);

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return startOfDay(out);
};

const addYears = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + n);
  return startOfDay(out);
};

const isSameDay = (a: Date | null, b: Date | null): boolean => {
  if (a == null || b == null) {
    return false;
  }
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const isSameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const isBefore = (a: Date, b: Date): boolean => startOfDay(a).getTime() < startOfDay(b).getTime();

const isAfter = (a: Date, b: Date): boolean => startOfDay(a).getTime() > startOfDay(b).getTime();

const calendarDaysFor = (month: Date): Date[] => {
  const firstOfMonth = startOfMonth(month);
  const leadingDays = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - leadingDays);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
};

const monthLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const fullDateLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * Single-month date range panel driven by `editing`. Each click emits a committed range with that
 * endpoint moved; an inverting click collapses both endpoints to the clicked day.
 *
 * **Accessibility.** Follows the ARIA Authoring Practices for date pickers:
 * - Grid with `role="grid"` / `role="row"` / `role="gridcell"`.
 * - Roving tabindex: only the focused day is `tabindex="0"`; arrow keys move it.
 * - Each cell carries a full-date `aria-label`, `aria-selected`, and `aria-current="date"` for today.
 * - Keyboard: Arrows (day/week), Home/End (week bounds), PageUp/PageDown (month), Shift+PgUp/PgDn
 *   (year), Enter/Space (commit). Month navigation also moves the focus pointer so the user never
 *   loses their place.
 * - Month label is `aria-live="polite"` so screen readers announce month changes.
 */
@Component({
  selector: "pam-date-range-picker",
  templateUrl: "./date-range-picker.component.html",
  imports: [CommonModule, IconButtonModule, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
})
export class DateRangePickerComponent {
  readonly startDate = input<Date | null>(null);
  readonly endDate = input<Date | null>(null);
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  readonly editing = input<EditingEnd>("start");
  /**
   * When `true`, the component moves DOM focus into the grid as soon as it renders. The field
   * wrapper flips this on when the popover opens so keyboard users land directly on the calendar.
   */
  readonly autofocus = input<boolean>(false);

  readonly rangeChange = output<DateRange>();

  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly today = startOfDay(new Date());

  private readonly viewMonth = signal<Date>(startOfMonth(new Date()));
  /** Which day in the grid currently owns the roving tabindex. */
  private readonly focusedDate = signal<Date>(this.today);
  private readonly hovered = signal<Date | null>(null);

  private readonly dayButtons = viewChildren<ElementRef<HTMLButtonElement>>("dayBtn");

  constructor() {
    // Center the view (and the focus pointer) on the endpoint being edited whenever the parent
    // binds a new range or switches which endpoint is being edited.
    effect(() => {
      const which = this.editing();
      const anchor = which === "start" ? this.startDate() : this.endDate();
      if (anchor != null) {
        const day = startOfDay(anchor);
        this.viewMonth.set(startOfMonth(day));
        this.focusedDate.set(day);
      }
    });

    // When the host flips `autofocus` on (e.g. the popover opened), move DOM focus into the grid.
    afterNextRender(() => {
      if (this.autofocus()) {
        this.focusCurrentDay();
      }
    });

    effect(() => {
      if (this.autofocus()) {
        this.focusCurrentDay();
      }
    });
  }

  protected readonly monthLabel = computed(() => monthLabel(this.viewMonth()));
  protected readonly weeks = computed(() => {
    const days = calendarDaysFor(this.viewMonth());
    return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  });

  private readonly displayRange = computed<DateRange | null>(() => {
    const start = this.startDate();
    const end = this.endDate();
    const hover = this.hovered();
    const which = this.editing();

    if (hover == null) {
      if (start != null && end != null) {
        return { start: startOfDay(start), end: startOfDay(end) };
      }
      return null;
    }

    const anchor = which === "start" ? end : start;
    if (anchor == null) {
      return { start: hover, end: hover };
    }
    const anchorDay = startOfDay(anchor);
    if (which === "start" && isAfter(hover, anchorDay)) {
      return { start: hover, end: hover };
    }
    if (which === "end" && isBefore(hover, anchorDay)) {
      return { start: hover, end: hover };
    }
    return isBefore(hover, anchorDay)
      ? { start: hover, end: anchorDay }
      : { start: anchorDay, end: hover };
  });

  protected prevMonth(): void {
    this.navigateMonths(-1);
  }

  protected nextMonth(): void {
    this.navigateMonths(1);
  }

  protected onHover(date: Date | null): void {
    this.hovered.set(date == null ? null : startOfDay(date));
  }

  protected onClick(date: Date): void {
    const click = startOfDay(date);
    const start = this.startDate();
    const end = this.endDate();
    const which = this.editing();

    if (which === "start") {
      const currentEnd = end == null ? click : startOfDay(end);
      const nextEnd = isAfter(click, currentEnd) ? click : currentEnd;
      this.rangeChange.emit({ start: click, end: nextEnd });
    } else {
      const currentStart = start == null ? click : startOfDay(start);
      const nextStart = isBefore(click, currentStart) ? click : currentStart;
      this.rangeChange.emit({ start: nextStart, end: click });
    }
  }

  /**
   * ARIA Authoring Practices date-picker keyboard model. Returns `true` when the key was handled,
   * so the template can call `event.preventDefault()` only in that case.
   */
  protected onKeydown(event: KeyboardEvent, date: Date): void {
    const current = startOfDay(date);
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        this.moveFocus(addDays(current, -1));
        break;
      case "ArrowRight":
        this.moveFocus(addDays(current, 1));
        break;
      case "ArrowUp":
        this.moveFocus(addDays(current, -7));
        break;
      case "ArrowDown":
        this.moveFocus(addDays(current, 7));
        break;
      case "Home":
        this.moveFocus(addDays(current, -current.getDay()));
        break;
      case "End":
        this.moveFocus(addDays(current, 6 - current.getDay()));
        break;
      case "PageUp":
        this.moveFocus(event.shiftKey ? addYears(current, -1) : addMonths(current, -1));
        break;
      case "PageDown":
        this.moveFocus(event.shiftKey ? addYears(current, 1) : addMonths(current, 1));
        break;
      case "Enter":
      case " ":
        this.onClick(current);
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
    }
  }

  private navigateMonths(delta: number): void {
    const nextView = addMonths(this.viewMonth(), delta);
    this.viewMonth.set(nextView);
    // Keep the focus pointer anchored on the same day-of-month in the new view when possible.
    const focused = this.focusedDate();
    const candidate = new Date(nextView.getFullYear(), nextView.getMonth(), focused.getDate());
    this.focusedDate.set(
      candidate.getMonth() === nextView.getMonth() ? candidate : startOfMonth(nextView),
    );
  }

  private moveFocus(target: Date): void {
    this.focusedDate.set(target);
    if (!isSameMonth(target, this.viewMonth())) {
      this.viewMonth.set(startOfMonth(target));
    }
    // Rendering updates in the next change-detection pass; move DOM focus after it lands.
    queueMicrotask(() => this.focusCurrentDay());
  }

  private focusCurrentDay(): void {
    const target = this.focusedDate();
    const buttons = this.dayButtons();
    for (const btn of buttons) {
      const ts = btn.nativeElement.dataset["dayTs"];
      if (ts != null && Number(ts) === target.getTime()) {
        btn.nativeElement.focus();
        return;
      }
    }
  }

  protected isDisabled(date: Date): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    if (min != null && isBefore(date, min)) {
      return true;
    }
    if (max != null && isAfter(date, max)) {
      return true;
    }
    return false;
  }

  protected inMonth(date: Date): boolean {
    return isSameMonth(date, this.viewMonth());
  }

  protected isToday(date: Date): boolean {
    return isSameDay(date, this.today);
  }

  protected isStart(date: Date): boolean {
    return isSameDay(date, this.displayRange()?.start ?? null);
  }

  protected isEnd(date: Date): boolean {
    const range = this.displayRange();
    return range != null && !isSameDay(range.start, range.end) && isSameDay(date, range.end);
  }

  protected isMidRange(date: Date): boolean {
    const range = this.displayRange();
    if (range == null || isSameDay(range.start, range.end)) {
      return false;
    }
    return isAfter(date, range.start) && isBefore(date, range.end);
  }

  protected isSelected(date: Date): boolean {
    return this.isStart(date) || this.isEnd(date);
  }

  protected isFocused(date: Date): boolean {
    return isSameDay(date, this.focusedDate());
  }

  protected isStartConnector(date: Date): boolean {
    const range = this.displayRange();
    return range != null && !isSameDay(range.start, range.end) && isSameDay(date, range.start);
  }

  protected isEndConnector(date: Date): boolean {
    const range = this.displayRange();
    return range != null && !isSameDay(range.start, range.end) && isSameDay(date, range.end);
  }

  protected dayAriaLabel(date: Date): string {
    const parts = [fullDateLabel(date)];
    if (this.isToday(date)) {
      parts.push("today");
    }
    if (this.isSelected(date)) {
      parts.push(this.isEnd(date) ? "end of range" : "start of range");
    } else if (this.isMidRange(date)) {
      parts.push("in selected range");
    }
    return parts.join(", ");
  }

  protected dayButtonClass(date: Date): string {
    const inThisMonth = this.inMonth(date);
    const disabled = this.isDisabled(date);
    const start = this.isStart(date);
    const end = this.isEnd(date);
    const today = this.isToday(date);
    const selected = start || end;

    const classes = [
      "tw-relative",
      "tw-z-10",
      "tw-size-9",
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-rounded-full",
      "tw-border-0",
      "tw-text-sm",
      "tw-cursor-pointer",
      "tw-bg-transparent",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-primary-600",
    ];

    if (disabled || !inThisMonth) {
      classes.push("tw-text-muted", "tw-cursor-not-allowed", "disabled:hover:tw-bg-transparent");
      return classes.join(" ");
    }

    // Endpoints get the solid primary pill so they always read as the brightest mark on the grid
    // (and sit visually above the softer in-range band). Today — when it isn't itself an endpoint —
    // gets a ring instead of a fill, so "today's identity" stays distinct from "picked".
    if (selected) {
      classes.push("tw-bg-primary-600", "tw-text-contrast", "tw-font-semibold");
    } else if (today) {
      classes.push(
        "tw-text-primary-600",
        "tw-font-semibold",
        "tw-ring-1",
        "tw-ring-inset",
        "tw-ring-primary-600",
      );
    } else {
      classes.push("tw-text-main", "hover:tw-bg-secondary-100");
    }

    return classes.join(" ");
  }
}
