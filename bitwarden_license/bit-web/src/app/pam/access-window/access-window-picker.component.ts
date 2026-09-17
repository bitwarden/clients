import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  LOCALE_ID,
  type Signal,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  IconButtonModule,
  IconModule,
  MenuModule,
  TypographyModule,
  inputBorderClasses,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { formatDuration } from "../date/format-duration";

import {
  type AccessWindowFormValue,
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  type RequestWindowProblem,
  accessWindowProblem,
  composeAccessWindow,
  composeInstant,
  toDateValue,
  toWindowEnd,
} from "./access-window";
import {
  type AccessWindowSuggestion,
  DEFAULT_FUTURE_DAY_TIME,
  addDays,
  admissibleEnd,
  dayTimes,
  fromTimeSuggestions,
  isToday,
  latestAdmissibleEnd,
  toSuggestions,
} from "./access-window-suggestions";
import { DayPickerComponent } from "./day-picker.component";
import { smoothSpan } from "./format-span";

/**
 * The bordered box that matches what `bitInput` draws, so the row reads as form controls.
 *
 * The border comes from {@link inputBorderClasses}, the same helper `BitInputDirective` composes
 * its host classes from. Passing the error flag through is what gives these triggers the danger
 * border every other field error has.
 *
 * Hover and focus are carried twice over, once for its own `:focus-visible` and once for a
 * descendant's, because the box is the control itself where it stands alone and a wrapper around
 * a control plus its affix where it does not.
 */
function boxClasses(error: boolean): string {
  return [
    "tw-flex tw-min-w-0 tw-items-center tw-rounded-lg tw-bg-background",
    ...inputBorderClasses(error),
    "hover:tw-border-border-brand focus-visible:tw-border-border-brand",
    "focus-visible:tw-outline-none focus-visible:tw-ring-1 focus-visible:tw-ring-border-brand",
    "has-[:focus-visible]:tw-border-border-brand has-[:focus-visible]:tw-ring-1",
    "has-[:focus-visible]:tw-ring-border-brand",
  ].join(" ");
}

/** A control's own content: its label, its icons, and the spacing around them. */
const CONTENT_CLASSES =
  "tw-flex tw-min-w-0 tw-items-center tw-gap-2 tw-py-2 tw-text-left tw-text-sm tw-text-fg-heading";

/** A control that stands alone, drawing its own box. */
function triggerClassesFor(error: boolean): string {
  return `${boxClasses(error)} ${CONTENT_CLASSES} tw-px-3`;
}

/**
 * A control sharing its box with a trailing affix: the box draws the border, the hover and the
 * focus ring for the pair, so the control inside must not draw any of them a second time.
 */
const AFFIXED_CLASSES =
  `${CONTENT_CLASSES} tw-grow tw-border-none tw-bg-transparent tw-ps-3 tw-pe-1 ` +
  "focus-visible:tw-outline-none";

/** The box around a control and its affix; the trailing inset is what keeps the affix off the border. */
function affixBoxClassesFor(error: boolean): string {
  return `${boxClasses(error)} tw-pe-1`;
}

/** Whether a control is showing its suggestions or the Custom affordance behind them. */
type PickerMode = "suggested" | "custom";

/** The id every control here points `aria-describedby` at while the window has a problem. */
const ERROR_ELEMENT_ID = "access-window-error";

/**
 * One rendered suggestion row, built in a `computed` rather than by methods bound in the template.
 *
 * `bit-menu` projects through an `<ng-content>` inside its own `<ng-template>`, and projected
 * content is created in the DECLARING view, so these rows are re-checked whenever the picker is
 * dirty, open or not. As template methods that cost an `Intl` format, a `smoothSpan` and two i18n
 * lookups per row per pass, across up to 48 rows nobody may have opened.
 */
type SuggestionRow = {
  /** The instant as epoch ms: the `@for` track key, and what the selection compares against. */
  key: number;
  suggestion: AccessWindowSuggestion;
  time: string;
  detail: string | null;
  /** The day, where the row lands on a later one than the start and has to say so. */
  day: string | null;
};

/**
 * Start/End picker for the window a human-approved access request asks for.
 *
 * Replaces the three bare `date` + `start` + `end` inputs the request form used to carry. Those
 * were honest but unhelpful: they made the requester do the arithmetic ("what time is two hours
 * from now?"), they expressed a window crossing midnight only as an *inverted* end time plus a
 * hint, and they let a window past the governing rule's cap be composed and only refused at
 * submit.
 *
 * What replaces them:
 *
 * - **Start** is a calendar plus a time menu. The day opens straight onto the calendar
 *   ({@link DayPickerComponent}): a start is almost always today, which the calendar already
 *   rests on, and where it is not, the requester has a date in mind and the grid is where a date
 *   is read. A menu of named days in front of it only asked the same question twice. The time
 *   menu reads relatively on today — now, and short steps out — and as a wall-clock ladder across
 *   the working day on any other day, because a future day has no "now" to be relative to. Both
 *   triggers carry the relative reading beside the clock time, the way the End trigger carries
 *   the span it buys.
 * - **End** is one menu of instants, each labelled with both the clock time it lands on and the
 *   span it buys. Spans and the natural points a person schedules to (end of the working day,
 *   midnight, midday tomorrow) are merged into one chronological list — see
 *   {@link toSuggestions}.
 * - Every suggestion is filtered to what submit would accept, so a requester who stays on the
 *   suggestions cannot compose a window the server will refuse.
 * - **Custom** never drops to a bare text field. On a time it opens a typed field; on the End side
 *   it opens a day/time pair with the day already on its calendar, which is how a multi-day
 *   window is expressed. The time keeps a Suggestions affix back to its own list, and the side
 *   keeps one return out of Custom altogether.
 * - Neither day control has a menu of named days. Both open their calendar: the day list could
 *   not even show a selection it had no name for — an end of "Thu, Sep 24" sat above a menu
 *   offering today, tomorrow and Monday — and the grid says everything it said.
 *
 * A composite control: one `formControlName` holding an {@link AccessWindowFormValue}, validating
 * itself against the rule's cap through {@link NG_VALIDATORS}. The problems it reports are the
 * existing {@link RequestWindowProblem} set under the existing error key, so the localized
 * messages and the `bit-error` rendering carry over unchanged.
 */
@Component({
  selector: "app-pam-access-window-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./access-window-picker.component.html",
  imports: [
    DayPickerComponent,
    IconButtonModule,
    IconModule,
    MenuModule,
    TypographyModule,
    I18nPipe,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AccessWindowPickerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AccessWindowPickerComponent),
      multi: true,
    },
  ],
})
export class AccessWindowPickerComponent implements ControlValueAccessor, Validator {
  /** The governing rule's cap on the window's length. Bounds the suggestions, not just the verdict. */
  readonly maxWindowSeconds = input.required<number>();

  /**
   * Pins the instant "now" means, for a test or a story that needs a fixed clock. Live otherwise:
   * the reference is re-read whenever a menu opens, so a form left open overnight still offers
   * today's suggestions rather than yesterday's.
   */
  readonly now = input<Date | null>(null);

  protected readonly affixedClasses = AFFIXED_CLASSES;

  private readonly locale = inject(LOCALE_ID);
  private readonly i18nService = inject(I18nService);
  private readonly injector = inject(Injector);

  /**
   * The controls a Custom choice hands off to, queried so that choice can hand focus — and, for a
   * day, the calendar — straight over. Each exists only while its side is in Custom mode.
   */
  private readonly startTimeInput = viewChild<ElementRef<HTMLElement>>("startTimeInput");
  private readonly endCalendarTrigger = viewChild<ElementRef<HTMLElement>>("endCalendarTrigger");
  private readonly endTimeInput = viewChild<ElementRef<HTMLElement>>("endTimeInput");

  private readonly liveNow = signal(new Date());

  /**
   * Bumped every time a calendar opens, which is what returns {@link DayPickerComponent} to the
   * month its selection is in. The picker cannot reset that itself: the overlay keeps the view
   * alive between opens, so a requester who paged forward two months and then dismissed the
   * calendar without choosing would find it still on that month the next time.
   */
  protected readonly calendarOpens = signal(0);
  private readonly reference = computed(() => this.now() ?? this.liveNow());

  protected readonly startDate = signal("");
  protected readonly startTime = signal("");
  protected readonly endDate = signal("");
  protected readonly endTime = signal("");

  protected readonly startTimeMode = signal<PickerMode>("suggested");
  protected readonly endMode = signal<PickerMode>("suggested");
  protected readonly endTimeMode = signal<PickerMode>("suggested");

  protected readonly disabled = signal(false);

  // ControlValueAccessor wiring, reassigned by Angular.
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange: (value: AccessWindowFormValue) => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onTouched: () => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onValidatorChange: () => void = () => {};

  constructor() {
    // The cap arrives from the pre-check after the control is bound, and it is an input rather
    // than a captured value, so Angular has to be told the verdict may have moved.
    effect(() => {
      this.maxWindowSeconds();
      this.onValidatorChange();
    });
  }

  // ---------------------------------------------------------------- values

  private get value(): AccessWindowFormValue {
    return {
      startDate: this.startDate(),
      startTime: this.startTime(),
      endDate: this.endDate(),
      endTime: this.endTime(),
    };
  }

  /**
   * The reference day the calendar marks as today and floors its selectable range at.
   *
   * Midnight, compared by value, so it only notifies when the calendar DAY turns over.
   * {@link refreshClock} writes a fresh `Date` on every menu open, and the grid reads this only
   * through `startOfDay` and `toDateValue`. Unnarrowed, opening the end-time menu rebuilt 62
   * cells on both grids for a clock that had not moved a day.
   */
  protected readonly referenceDay = computed(
    () => {
      const at = this.reference();
      return new Date(at.getFullYear(), at.getMonth(), at.getDate());
    },
    { equal: (a, b) => a.getTime() === b.getTime() },
  );

  protected readonly start = computed(() => composeInstant(this.startDate(), this.startTime()));
  protected readonly end = computed(() => composeInstant(this.endDate(), this.endTime()));

  /** The composed window's length in seconds, `null` while either end is unresolved. */
  protected readonly spanSeconds = computed(() => {
    const start = this.start();
    const end = this.end();
    return start == null || end == null ? null : (end.getTime() - start.getTime()) / 1000;
  });

  // ------------------------------------------------------------ suggestions

  protected readonly startSuggestions = computed(() =>
    fromTimeSuggestions(this.startDate(), this.reference()),
  );

  /** The last instant an end may fall on. See {@link latestAdmissibleEnd}. */
  protected readonly latestEnd = computed(() => {
    const start = this.start();
    return start == null ? null : latestAdmissibleEnd(start, this.maxWindowSeconds());
  });

  /**
   * Absolute times for the end day the requester picked, narrowed to what submit would accept.
   *
   * Empty where the chosen day is entirely outside the rule's cap — which is honest rather than
   * hostile: the day was reached through Custom, and the message under the row says why nothing
   * on it works.
   */
  protected readonly endTimeSuggestions = computed(() => {
    const start = this.start();
    const day = this.endDate();
    if (start == null || !day) {
      return [];
    }
    // The same predicate `toSuggestions` filters by, not a second copy. An already-elapsed end
    // is one submit refuses, so this was the one list that could offer a window the picker then
    // complained about.
    return dayTimes(day).filter(admissibleEnd(start, this.maxWindowSeconds(), this.reference()));
  });

  protected readonly endSuggestions = computed(() => {
    const start = this.start();
    return start == null ? [] : toSuggestions(start, this.maxWindowSeconds(), this.reference());
  });

  // ----------------------------------------------------------------- labels

  /** "Today" / "Tomorrow" / "Fri, Sep 19" — a relative name where there is one, a date otherwise. */
  protected readonly startDayLabel = computed(() => this.dayLabel(this.startDate()));

  protected readonly startTimeLabel = computed(() => {
    const at = this.start();
    return at == null ? this.i18nService.t("pamAccessWindowPickATime") : this.timeLabel(at);
  });

  /**
   * A span as the picker reads it out loud: smoothed to ten minutes, and marked with a tilde when
   * that rounding moved it. See {@link smoothSpan} for why every relative reading here is
   * approximate; the tilde is what keeps the smoothing honest.
   *
   * The rule's cap does NOT come through here. A limit is not an approximation: the requester is
   * being told the exact boundary their window was refused against, and "~4 hr" would put a
   * number they can compose against three minutes away from the truth.
   */
  private approximateSpan(seconds: number): string {
    const { text, approximate } = smoothSpan(this.locale, seconds);
    return approximate ? this.i18nService.t("pamAccessWindowApproximateSpan", text) : text;
  }

  /**
   * The relative reading beside the From time — "now", "in 30 min", "in ~30 min".
   *
   * Parity with the To trigger, which carries the span it buys: between them the pair answers
   * "when does this start?" and "how long does it run?", and the From was the one answering in
   * bare clock time while the menu behind it had been reading relatively all along.
   *
   * Phrased as the menu phrases it, "in 30 min" and not "30 min", because the number beside the
   * To is a length of access and this one is a delay before it starts — the preposition is what
   * keeps two identically-formatted spans apart at a glance.
   *
   * Computed against the reference clock rather than remembered from the suggestion that was
   * picked: "in 30 min" chosen ten minutes ago is no longer true, and the reference is re-read
   * whenever a menu opens. A start already at or behind the clock reads as "now" — the same thing
   * the first suggestion says, and a start is allowed to sit in the past (the lease begins at
   * activation, not at the requested instant).
   */
  protected readonly startTimeDetail = computed(() => {
    const at = this.start();
    if (at == null) {
      return null;
    }
    const seconds = (at.getTime() - this.reference().getTime()) / 1000;
    return seconds < 60
      ? this.i18nService.t("pamAccessWindowNow")
      : this.i18nService.t("pamAccessWindowInSpan", this.approximateSpan(seconds));
  });

  /**
   * The To trigger carries the span as well as the instant, because the span is what the
   * requester is actually deciding and what the approver will weigh.
   */
  protected readonly endLabel = computed(() => {
    const at = this.end();
    if (at == null) {
      return this.i18nService.t("pamAccessWindowPickAnEnd");
    }
    const sameDay = this.endDate() === this.startDate();
    return sameDay ? this.timeLabel(at) : `${this.dayLabel(this.endDate())}, ${this.timeLabel(at)}`;
  });

  /** The end day on its own, for the To side's Custom pair. */
  protected readonly endDayLabel = computed(() =>
    this.endDate() ? this.dayLabel(this.endDate()) : this.i18nService.t("pamAccessWindowPickADay"),
  );

  protected readonly endTimeLabel = computed(() => {
    const at = this.end();
    return at == null ? this.i18nService.t("pamAccessWindowPickATime") : this.timeLabel(at);
  });

  protected readonly endSpanLabel = computed(() => {
    const seconds = this.spanSeconds();
    return seconds == null || seconds <= 0 ? null : this.approximateSpan(seconds);
  });

  /**
   * The composed window spelled out in full, under the two compact triggers.
   *
   * Not redundant with them: between them the triggers say "Today", "9:00 AM" and "12:00 PM", and
   * a requester about to put a justification in front of an approver deserves to see the whole
   * thing said once, in one reading order, before they submit.
   */
  protected readonly summary = computed(() => {
    const start = this.start();
    const span = this.endSpanLabel();
    if (start == null || this.end() == null || span == null) {
      return null;
    }
    // The end half is `endLabel` verbatim; it already decides whether the end carries its day,
    // and restating that rule here left two branches that had to agree. Its placeholder branch is
    // unreachable, since a null end returned above.
    const range = `${this.dayLabel(this.startDate())}, ${this.timeLabel(start)} – ${this.endLabel()}`;
    return this.i18nService.t("pamAccessWindowSummary", span, range);
  });

  /**
   * The instant each side holds, as epoch ms. Kept out of the row computeds so moving the
   * selection re-marks the list without re-formatting every label in it.
   */
  protected readonly startMs = computed(() => this.start()?.getTime() ?? null);
  protected readonly endMs = computed(() => this.end()?.getTime() ?? null);

  private toRows(
    suggestions: AccessWindowSuggestion[],
    { withDay }: { withDay: boolean } = { withDay: false },
  ): SuggestionRow[] {
    return suggestions.map((suggestion) => ({
      key: suggestion.at.getTime(),
      suggestion,
      time: this.timeLabel(suggestion.at),
      detail: this.suggestionDetail(suggestion),
      day: withDay ? this.suggestionDayLabel(suggestion) : null,
    }));
  }

  protected readonly startRows = computed(() => this.toRows(this.startSuggestions()));

  /**
   * The merged End list is the one that reaches later days, so it names them. The day/time pair's
   * time list has its day spelled out beside it already.
   */
  protected readonly endRows = computed(() =>
    this.toRows(this.endSuggestions(), { withDay: true }),
  );

  protected readonly endTimeRows = computed(() => this.toRows(this.endTimeSuggestions()));

  /**
   * The window's problem, if it has one — the same verdict {@link validate} reports.
   *
   * Rendered here rather than left to the host, so the message and the `aria-invalid` /
   * `aria-describedby` wiring that points at it stay in one place, next to the controls they
   * describe. Read live off the signals, unlike `validate`, which Angular only calls when the
   * control revalidates.
   */
  protected readonly problem = computed(() =>
    accessWindowProblem(this.value, this.maxWindowSeconds(), this.reference()),
  );

  /** Each control's box, carrying the danger border while the composed window has a problem. */
  protected readonly triggerClasses = computed(() => triggerClassesFor(this.errorText() != null));
  protected readonly affixBoxClasses = computed(() => affixBoxClassesFor(this.errorText() != null));

  /**
   * The `aria-invalid` / `aria-describedby` pair every control in the row carries. Computed, not a
   * ternary at each of seven controls: the spec asserts three of them match the error's own id, so
   * a drifting copy was a silent a11y regression.
   */
  protected readonly ariaInvalid = computed(() => (this.errorText() == null ? null : "true"));
  protected readonly ariaErrorId = computed(() =>
    this.errorText() == null ? null : ERROR_ELEMENT_ID,
  );

  /**
   * Whether either end is still unresolved, which {@link accessWindowProblem} deliberately says
   * nothing about — it judges windows, and there is no window here yet.
   */
  private readonly incomplete = computed(() => this.start() == null || this.end() == null);

  /**
   * The message under the row: the window's problem, or the fact that there isn't a window yet.
   *
   * The incomplete case has to be said out loud. A requester can reach it — clearing a typed time
   * leaves the control holding `""` — and until it was said, `validate()` refused the form with
   * `{ required: true }` while nothing anywhere rendered a reason, so Submit went dead with no
   * explanation. The three `bit-form-field`s this replaced got that message from
   * `Validators.required` for free.
   */
  protected readonly errorText = computed(() => {
    if (this.incomplete()) {
      return this.i18nService.t("pamAccessWindowIncomplete");
    }
    const problem = this.problem();
    return problem == null ? null : this.problemMessage(problem);
  });

  /**
   * A suggestion's secondary line: what makes it worth offering. A relative reading on today, the
   * name of a natural point where it has one, the span it buys otherwise.
   */
  private suggestionDetail(suggestion: AccessWindowSuggestion): string | null {
    switch (suggestion.kind.type) {
      case "now":
        return this.i18nService.t("pamAccessWindowNow");
      case "offset":
        return this.i18nService.t(
          "pamAccessWindowInSpan",
          this.approximateSpan(suggestion.kind.seconds),
        );
      case "timeOfDay":
        return null;
      case "span":
        return this.approximateSpan(suggestion.kind.seconds);
      // Deliberately unnamed: a round clock reading needs no gloss, and "end of the work day"
      // asserts something about the requester's day that the product does not know.
      case "endOfWorkDay":
        return this.spanFrom(suggestion);
      case "midnight":
        return this.detailWithSpan("pamAccessWindowMidnight", suggestion);
      case "nextDayMidday":
        return this.detailWithSpan("pamAccessWindowMidday", suggestion);
    }
  }

  /**
   * A named point reads as its name *and* its span — the name says why, the span says how much.
   *
   * The name never carries a day. It used to: the midday anchor read "Midday tomorrow", which was
   * relative to the START rather than to now — from a start of Tomorrow it glossed Saturday as
   * "tomorrow" — and, from a start of today, it repeated the "Tomorrow" the row's own primary line
   * already said. Every relative day name in this picker is anchored on the clock, and
   * {@link suggestionDayLabel} is where it belongs.
   */
  private detailWithSpan(nameKey: string, suggestion: AccessWindowSuggestion): string {
    const name = this.i18nService.t(nameKey);
    const span = this.spanFrom(suggestion);
    return span == null ? name : `${name} · ${span}`;
  }

  /** How long the window would run if it ended here; `null` before a start is resolved. */
  private spanFrom(suggestion: AccessWindowSuggestion): string | null {
    const start = this.start();
    if (start == null) {
      return null;
    }
    return this.approximateSpan((suggestion.at.getTime() - start.getTime()) / 1000);
  }

  /** Whether a To suggestion lands on a later day, which the list has to say out loud. */
  private suggestionDayLabel(suggestion: AccessWindowSuggestion): string | null {
    const start = this.start();
    if (start == null) {
      return null;
    }
    const day = toDateValue(suggestion.at);
    return day === toDateValue(start) ? null : this.dayLabel(day);
  }

  // Constructing an `Intl.DateTimeFormat` is the expensive part of that API, and these run once
  // per rendered row — up to 48 in a day's ladder — on every change-detection pass. Held as
  // computeds so each is built once per locale, the way `format-span.ts` caches its number
  // formatters.
  private readonly timeFormat = computed(
    () => new Intl.DateTimeFormat(this.locale, { timeStyle: "short" }),
  );
  private readonly dateFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale, { weekday: "short", month: "short", day: "numeric" }),
  );

  private timeLabel(at: Date): string {
    return this.timeFormat().format(at);
  }

  private dayLabel(dateValue: string): string {
    const at = composeInstant(dateValue, "00:00");
    if (at == null) {
      return "";
    }
    const today = this.reference();
    if (dateValue === toDateValue(today)) {
      return this.i18nService.t("pamAccessWindowToday");
    }
    if (dateValue === toDateValue(addDays(today, 1))) {
      return this.i18nService.t("pamAccessWindowTomorrow");
    }
    return this.dateFormat().format(at);
  }

  // ------------------------------------------------------------ interaction

  /** Re-reads the clock as a menu opens, so a long-open form's suggestions are never stale. */
  protected refreshClock(): void {
    if (this.now() == null) {
      this.liveNow.set(new Date());
    }
  }

  /** As {@link refreshClock}, plus the month reset a reopened calendar needs. */
  protected openCalendar(): void {
    this.refreshClock();
    this.calendarOpens.update((opens) => opens + 1);
  }

  protected selectStartDay(dateValue: string): void {
    const previousStart = this.start();
    this.startDate.set(dateValue);
    // A day is chosen, but the time that made sense on the old day may not exist as a suggestion
    // on the new one: today's "now" is meaningless on a future day, and a future day's ladder
    // starts at the working day. Re-seed the time to that day's own default, then let the end
    // follow the start as usual.
    // Both branches leave a typed time alone, for the same reason: it is the one value here the
    // requester entered by hand. Only the today branch used to overwrite it, so moving the day
    // out and back again quietly replaced 06:15 with "now".
    const reseedable = previousStart == null || this.startTimeMode() === "suggested";
    if (isToday(dateValue, this.reference())) {
      const first = this.startSuggestions()[0];
      if (first != null && reseedable) {
        this.startTime.set(toWindowEnd(first.at).time);
      }
    } else if (reseedable) {
      this.startTime.set(DEFAULT_FUTURE_DAY_TIME);
    }
    this.reanchorEnd(previousStart);
    this.emit();
  }

  /**
   * Writes one instant onto the end's pair of controls. Spelled out at four call sites, which is
   * how `clampEndTime` came to guard the calendar path alone while {@link reanchorEnd} carried
   * its own clamp.
   */
  private writeEnd(at: Date): void {
    const { date, time } = toWindowEnd(at);
    this.endDate.set(date);
    this.endTime.set(time);
  }

  protected selectStartTime(row: SuggestionRow): void {
    const previousStart = this.start();
    this.startTimeMode.set("suggested");
    const { date, time } = toWindowEnd(row.suggestion.at);
    this.startDate.set(date);
    this.startTime.set(time);
    this.reanchorEnd(previousStart);
    this.emit();
  }

  protected selectEnd(row: SuggestionRow): void {
    this.endMode.set("suggested");
    this.writeEnd(row.suggestion.at);
    this.emit();
  }

  protected selectEndTime(row: SuggestionRow): void {
    this.endTimeMode.set("suggested");
    this.writeEnd(row.suggestion.at);
    this.emit();
  }

  /**
   * The To side's calendar. Keeps the time the requester already chose, pulled back onto what the
   * new day allows.
   *
   * Keeping the time is the point of the calendar path — someone who wanted 5 PM and moved the
   * day still wants 5 PM — but the last day inside the cap only allows part of itself, and on
   * that day the kept time is as likely as not to sit past the cutoff. Handing that back as a
   * validation error makes the requester do the arithmetic the picker exists to do for them, so
   * the time moves instead: to the latest minute the day admits, which is the window they were
   * reaching for anyway.
   */
  protected setEndDate(dateValue: string): void {
    this.endDate.set(dateValue);
    this.clampEndTime();
    this.emit();
  }

  /**
   * Pulls the end's time inside the admissible range for its current day, where it has fallen
   * outside it.
   *
   * Only ever moves the time, never the day: the day is what the requester just chose, and the
   * calendar has already refused the days no admissible end lives on at all. The far bound is the
   * cap, clamped exactly, the way {@link reanchorEnd} clamps a preserved span. The near bound —
   * an end at or before the start — lands on the day's first admissible suggestion instead, since
   * "one minute after the start" is a time nobody asked for.
   */
  private clampEndTime(): void {
    const start = this.start();
    const end = this.end();
    const latest = this.latestEnd();
    if (start == null || end == null || latest == null) {
      return;
    }
    if (end.getTime() > latest.getTime() && this.endDate() === toDateValue(latest)) {
      this.endTime.set(toWindowEnd(latest).time);
      return;
    }
    if (end.getTime() <= start.getTime()) {
      const first = this.endTimeSuggestions()[0];
      if (first != null) {
        this.endTime.set(toWindowEnd(first.at).time);
      }
    }
  }

  protected useCustomStartTime(): void {
    this.startTimeMode.set("custom");
    this.handOffTo(this.startTimeInput, { open: false });
  }

  /**
   * Custom on the To side goes straight into the calendar.
   *
   * It used to open the day/time pair with the day on its own menu of named days, which put two
   * clicks and a menu that half-repeats itself between the requester and the only control that
   * can express what they came here for. The merged list they just dismissed already reached
   * every end on the start's day and the next morning, so the end they want is on a later day —
   * and the calendar addresses every one of those, the named days included.
   */
  protected useCustomEnd(): void {
    this.endMode.set("custom");
    this.endTimeMode.set("suggested");
    this.handOffTo(this.endCalendarTrigger, { open: true });
  }

  protected useCustomEndTime(): void {
    this.endTimeMode.set("custom");
    this.handOffTo(this.endTimeInput, { open: false });
  }

  /**
   * Hands the requester the control that replaced the menu they chose Custom in.
   *
   * Two things the bare mode switch misses. The menu that closed took focus with it — it restores
   * focus to its own trigger, and that trigger is the element being replaced — so focus would
   * otherwise fall to the document. And a day's Custom is only ever chosen to reach the calendar,
   * so the calendar opens here rather than waiting behind one more click on a control that looks
   * identical to the one just dismissed. Opening it through the trigger's own click handling
   * keeps `bitMenuTriggerFor` the single owner of the overlay, and the dialog-role menu captures
   * focus onto the selected day on the way in.
   *
   * Deferred to the next render because the control does not exist until the mode signal has been
   * applied to the DOM.
   */
  private handOffTo(
    control: Signal<ElementRef<HTMLElement> | undefined>,
    { open }: { open: boolean },
  ): void {
    afterNextRender(
      () => {
        const element = control()?.nativeElement;
        if (element == null) {
          return;
        }
        element.focus();
        // Open, never toggle: the To side reaches its calendar both from its own Custom and from
        // the day control's, and a hand-off onto an already-open menu would close it.
        if (open && element.getAttribute("aria-expanded") !== "true") {
          element.click();
        }
      },
      { injector: this.injector },
    );
  }

  /**
   * Returns a time control to its suggestions, keeping whatever the requester typed.
   *
   * It used to snap the value onto the first suggestion, to hold the invariant "while on
   * suggestions, the value is one of them". That invariant buys nothing — the menu marks the
   * current value where it matches one and marks nothing where it doesn't — and it cost something
   * real: a control labelled "Suggestions", carrying a list icon, silently replaced a typed 15:00
   * with "now" and dragged the end along behind it. Nothing else in the picker discards a value
   * the requester entered by hand.
   */
  protected useSuggestedEndTime(): void {
    this.endTimeMode.set("suggested");
  }

  protected useSuggestedStartTime(): void {
    this.startTimeMode.set("suggested");
  }

  protected useSuggestedEnd(): void {
    this.endMode.set("suggested");
    const first = this.endSuggestions()[0];
    if (first != null) {
      this.writeEnd(first.at);
      this.emit();
    }
  }

  protected setCustomStartTime(event: Event): void {
    // Read before the write, so a typed start preserves the requester's span the way a chosen one
    // does. Reading it after threw the span away and collapsed the end onto the first suggestion:
    // an 09:00-17:00 window retyped to start at 08:30 became half an hour.
    const previousStart = this.start();
    this.startTime.set(timeFrom(event));
    this.reanchorEnd(previousStart);
    this.emit();
  }

  protected setCustomEndTime(event: Event): void {
    this.endTime.set(timeFrom(event));
    this.emit();
  }

  /**
   * Keeps the end the requester's length when the start moves.
   *
   * Preserving the span, rather than the end instant, is what matches intent: someone who asked
   * for three hours and then moved the day still wants three hours. Only done while the To side is
   * on its suggestions — a typed custom end is an absolute instant the requester chose on purpose,
   * so it is left alone and left to the validator.
   *
   * Clamped to the cap, since the same span on a new start can now exceed it.
   */
  private reanchorEnd(previousStart: Date | null): void {
    if (this.endMode() === "custom") {
      return;
    }
    const start = this.start();
    if (start == null) {
      return;
    }
    const previousEnd = this.end();
    const previousSpanMs =
      previousStart != null && previousEnd != null
        ? previousEnd.getTime() - previousStart.getTime()
        : null;

    if (previousSpanMs != null && previousSpanMs > 0) {
      // Clamped through the helper the calendar bounds and the suggestion filter use, so a
      // preserved span cannot outrun a cap they all agree on.
      const at = new Date(start.getTime() + previousSpanMs);
      const latest = latestAdmissibleEnd(start, this.maxWindowSeconds());
      this.writeEnd(at.getTime() > latest.getTime() ? latest : at);
      return;
    }
    const first = this.endSuggestions()[0];
    if (first != null) {
      this.writeEnd(first.at);
    }
  }

  protected markTouched(): void {
    this.onTouched();
  }

  private emit(): void {
    this.onChange(this.value);
    this.onValidatorChange();
  }

  // -------------------------------------------------- ControlValueAccessor

  writeValue(value: AccessWindowFormValue | null): void {
    this.startDate.set(value?.startDate ?? "");
    this.startTime.set(value?.startTime ?? "");
    this.endDate.set(value?.endDate ?? "");
    this.endTime.set(value?.endTime ?? "");
    // A value written from outside is by definition not something the requester picked here, so
    // every control goes back to its suggestions.
    this.startTimeMode.set("suggested");
    this.endMode.set("suggested");
    this.endTimeMode.set("suggested");
  }

  registerOnChange(fn: (value: AccessWindowFormValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ------------------------------------------------------------- Validator

  validate(_control: AbstractControl): ValidationErrors | null {
    if (composeAccessWindow(this.value) == null) {
      return { required: true };
    }
    // The true clock, not `reference()`: a verdict has to be read against the instant it is
    // given, and the reference is only as fresh as the last menu the requester opened — a window
    // that elapsed while the form sat open would otherwise still pass. A pinned clock wins where
    // there is one, since a story or a test that fixes "now" means it for the verdict too;
    // nothing in production passes one.
    const problem = accessWindowProblem(
      this.value,
      this.maxWindowSeconds(),
      this.now() ?? new Date(),
    );
    if (problem == null) {
      return null;
    }
    const error: RequestWindowError = { problem, message: this.problemMessage(problem) };
    return { [REQUEST_WINDOW_ERROR_KEY]: error };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  private problemMessage(problem: RequestWindowProblem): string {
    switch (problem) {
      case "zeroLengthWindow":
        return this.i18nService.t("requestAccessModalEndEqualsStart");
      case "endInPast":
        return this.i18nService.t("requestAccessModalWindowInPast");
      case "exceedsMaxWindow":
        // `formatDuration`, not `formatSpan`: a rule's cap is round by construction, the division
        // `format-span.ts` draws for itself. It also matches the "Maximum" line the card renders
        // above through `| durationLong`. One card saying "4 hours" then "4 hr" is a copy bug.
        return this.i18nService.t(
          "requestAccessModalWindowExceedsMax",
          formatDuration(this.locale, this.maxWindowSeconds(), "long"),
        );
    }
  }
}

/** The `HH:mm` a typed time control now holds. */
function timeFrom(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
