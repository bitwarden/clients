// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgFor, NgIf } from "@angular/common";
import {
  Component,
  ViewChild,
  input,
  signal,
  computed,
  Optional,
  Self,
  ElementRef,
  HostBinding,
} from "@angular/core";
import { ControlValueAccessor, NgControl, Validators } from "@angular/forms";

import { BitFormFieldControl } from "../form-field/form-field-control";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { BitInputDirective } from "../input/input.directive";
import { PopoverTriggerForDirective } from "../popover/popover-trigger-for.directive";
import { PopoverComponent } from "../popover/popover.component";

let nextId = 0;

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
}

@Component({
  selector: "bit-date-picker",
  standalone: true,
  imports: [NgFor, NgIf, BitInputDirective, PopoverComponent, PopoverTriggerForDirective],
  styles: [
    `
      :host ::ng-deep bit-popover .tw-w-72 {
        width: 24rem !important;
      }
    `,
  ],
  template: `
    <div class="tw-relative tw-flex tw-items-center">
      <input
        #dateInput
        [id]="id()"
        [value]="displayValue()"
        [placeholder]="placeholder() || 'Select a date'"
        [disabled]="disabled"
        (input)="onInput($event)"
        (blur)="onBlur()"
        (keydown)="onKeyDown($event)"
        autocomplete="off"
        type="text"
        bitInput
        maxlength="10"
        class="tw-w-full tw-bg-transparent tw-pl-1 tw-pr-12 tw-py-2.5 tw-border tw-rounded-lg tw-text-main tw-border-secondary-300 tw-outline-none tw-transition focus:tw-border-primary-600"
      />

      <span
        class="tw-absolute tw-right-0 tw-pr-4 tw-text-muted tw-cursor-pointer"
        #popoverTrigger="popoverTrigger"
        [bitPopoverTriggerFor]="calendarPopover"
        [position]="'below-center'"
        (click)="onCalendarIconClick()"
      >
        <svg
          class="tw-fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.5 3.3125H15.8125V2.625C15.8125 2.25 15.5 1.90625 15.0937 1.90625C14.6875 1.90625 14.375 2.21875 14.375 2.625V3.28125H5.59375V2.625C5.59375 2.25 5.28125 1.90625 4.875 1.90625C4.46875 1.90625 4.15625 2.21875 4.15625 2.625V3.28125H2.5C1.4375 3.28125 0.53125 4.15625 0.53125 5.25V16.125C0.53125 17.1875 1.40625 18.0937 2.5 18.0937H17.5C18.5625 18.0937 19.4687 17.2187 19.4687 16.125V5.25C19.4687 4.1875 18.5625 3.3125 17.5 3.3125ZM2.5 4.71875H4.1875V5.34375C4.1875 5.71875 4.5 6.0625 4.90625 6.0625C5.3125 6.0625 5.625 5.75 5.625 5.34375V4.71875H14.4687V5.34375C14.4687 5.71875 14.7812 6.0625 15.1875 6.0625C15.5937 6.0625 15.9062 5.75 15.9062 5.34375V4.71875H17.5C17.8125 4.71875 18.0625 4.96875 18.0625 5.28125V7.34375H1.96875V5.28125C1.96875 4.9375 2.1875 4.71875 2.5 4.71875ZM17.5 16.6562H2.5C2.1875 16.6562 1.9375 16.4062 1.9375 16.0937V8.71875H18.0312V16.125C18.0625 16.4375 17.8125 16.6562 17.5 16.6562Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </div>

    <bit-popover #calendarPopover>
      <div class="tw-w-full tw-bg-background tw-border-0 tw-p-2">
        <!-- Navigation Header -->
        <div class="tw-flex tw-items-center tw-justify-center tw-gap-4 tw-px-2 tw-pb-2">
          <button
            type="button"
            (click)="previousPeriod()"
            class="tw-bg-transparent tw-border-0 tw-size-8 tw-text-main tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-text-lg tw-rounded-full hover:tw-bg-primary-600 hover:tw-text-contrast tw-transition-colors"
          >
            ‹
          </button>
          <div
            class="tw-text-sm tw-text-main tw-flex-1 tw-text-center tw-cursor-pointer tw-px-2 tw-py-1 tw-rounded-full hover:tw-bg-primary-600 hover:tw-text-contrast tw-transition-colors"
            (click)="switchToNextView()"
          >
            {{ getHeaderTitle() }}
          </div>
          <button
            type="button"
            (click)="nextPeriod()"
            class="tw-bg-transparent tw-border-0 tw-size-8 tw-text-main tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-text-lg tw-rounded-full hover:tw-bg-primary-600 hover:tw-text-contrast tw-transition-colors"
          >
            ›
          </button>
        </div>

        <!-- Day View -->
        <div *ngIf="viewMode() === 'day'">
          <!-- Week Days Header -->
          <div class="tw-grid tw-grid-cols-7 tw-gap-1 tw-my-2 tw-px-2 tw-justify-items-center">
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Sun</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Mon</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Tue</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Wed</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Thu</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Fri</div>
            <div class="tw-text-center tw-text-xs tw-font-medium tw-text-muted tw-py-1">Sat</div>
          </div>

          <!-- Calendar Grid -->
          <div class="tw-grid tw-grid-cols-7 tw-gap-1 tw-px-2 tw-pb-2 tw-justify-items-center">
            <div
              *ngFor="let day of calendarDaysWithBlanks()"
              [class]="getDayClasses(day)"
              (click)="day.inCurrentMonth && selectDate(day)"
            >
              {{ day.date.getDate() }}
            </div>
          </div>
        </div>

        <!-- Month View -->
        <div *ngIf="viewMode() === 'month'" class="tw-grid tw-grid-cols-3 tw-gap-1 tw-px-2 tw-pb-2">
          <div
            *ngFor="let month of yearMonths()"
            class="tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-w-16 tw-h-6 tw-text-sm tw-rounded-full tw-text-main hover:tw-bg-primary-600 hover:tw-text-contrast tw-transition-colors"
            (click)="selectMonth(month.value)"
          >
            {{ month.name }}
          </div>
        </div>

        <!-- Year View -->
        <div *ngIf="viewMode() === 'year'" class="tw-grid tw-grid-cols-3 tw-gap-1 tw-px-2 tw-pb-2">
          <div
            *ngFor="let year of decadeYears()"
            class="tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-w-12 tw-h-6 tw-text-sm tw-rounded-full tw-text-main hover:tw-bg-primary-600 hover:tw-text-contrast tw-transition-colors"
            (click)="selectYear(year)"
          >
            {{ year }}
          </div>
        </div>
      </div>
    </bit-popover>
  `,
  providers: [{ provide: BitFormFieldControl, useExisting: BitDatePickerComponent }],
  host: {
    "[attr.aria-describedby]": "ariaDescribedBy",
  },
})
export class BitDatePickerComponent implements BitFormFieldControl, ControlValueAccessor {
  @ViewChild("dateInput") dateInput: ElementRef<HTMLInputElement>;
  @ViewChild("popoverTrigger") popoverTrigger: PopoverTriggerForDirective;

  readonly id = input(`bit-date-picker-${nextId++}`);
  readonly placeholder = input<string>();

  disabled = false;
  ariaDescribedBy: string;

  protected selectedDate = signal<Date | null>(null);
  protected currentMonth = signal<Date>(new Date());
  protected viewMode = signal<"day" | "month" | "year">("day");
  protected currentYear = signal<number>(new Date().getFullYear());
  protected currentDecade = signal<number>(Math.floor(new Date().getFullYear() / 10) * 10);

  protected monthName = computed(() => {
    return this.currentMonth().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  });

  protected yearMonths = computed(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(this.currentYear(), i, 1);
      months.push({
        name: date.toLocaleDateString("en-US", { month: "short" }),
        fullName: date.toLocaleDateString("en-US", { month: "long" }),
        value: i,
      });
    }
    return months;
  });

  protected decadeYears = computed(() => {
    const startYear = this.currentDecade();
    const years = [];
    for (let i = 0; i < 12; i++) {
      years.push(startYear + i);
    }
    return years;
  });

  protected calendarDays = computed(() => {
    return this.generateCalendarDays(this.currentMonth());
  });

  protected currentMonthDays = computed(() => {
    return this.calendarDays().filter((day) => day.inCurrentMonth);
  });

  protected calendarDaysWithBlanks = computed(() => {
    return this.calendarDays();
  });

  private notifyOnChange?: (value: string | null) => void;
  private notifyOnTouched?: () => void;

  @HostBinding("attr.aria-invalid") get ariaInvalid() {
    return this.hasError ? true : undefined;
  }

  protected displayValue = (): string => {
    const date = this.selectedDate();
    return date ? this.formatDate(date) : "";
  };

  get labelForId(): string {
    return this.id();
  }

  get required(): boolean {
    return this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }

  get hasError(): boolean {
    return this.ngControl?.status === "INVALID" && this.ngControl?.touched;
  }

  get error(): [string, any] {
    if (!this.ngControl?.errors) {
      return ["", null];
    }
    const key = Object.keys(this.ngControl.errors)[0];
    return [key, this.ngControl.errors[key]];
  }

  constructor(
    @Optional() @Self() private ngControl: NgControl,
    @Optional() private parentFormField: BitFormFieldComponent,
  ) {
    if (ngControl != null) {
      ngControl.valueAccessor = this;
    }
  }

  onCalendarIconClick() {
    // When calendar icon is clicked, set calendar to show the typed date if valid
    const inputValue = this.dateInput?.nativeElement.value;
    if (inputValue) {
      const parsedDate = this.parseDate(inputValue);
      if (parsedDate) {
        this.currentMonth.set(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
        this.currentYear.set(parsedDate.getFullYear());
        this.selectedDate.set(parsedDate);
      }
    }
    // Always reset to day view when opening
    this.viewMode.set("day");
  }

  focus() {
    this.dateInput?.nativeElement?.focus();
  }

  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = this.formatAndValidateInput(target.value);
    target.value = newValue;

    // Only update selected date if we have a complete, valid date
    const parsedDate = this.parseDate(newValue);
    if (parsedDate && newValue.length === 10) {
      this.selectedDate.set(parsedDate);
    } else if (newValue.length === 0) {
      this.selectedDate.set(null);
    }

    this.notifyOnChange?.(parsedDate ? this.formatDateForForm(parsedDate) : null);
  }

  onBlur() {
    this.notifyOnTouched?.();
  }

  onKeyDown(event: KeyboardEvent) {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];

    if (allowedKeys.includes(event.key)) {
      return;
    }

    // Only allow numbers (no manual slash entry - we'll auto-add them)
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const target = event.target as HTMLInputElement;
    const currentValue = target.value;
    const cursorPosition = target.selectionStart || 0;
    const digit = parseInt(event.key);

    // Validate based on position in MM/DD/YYYY format
    if (cursorPosition === 0) {
      // First digit of month: 0 or 1
      if (digit > 1) {
        event.preventDefault();
      }
    } else if (cursorPosition === 1) {
      // Second digit of month
      const firstDigit = parseInt(currentValue[0] || "0");
      if (firstDigit === 1 && digit > 2) {
        event.preventDefault(); // Can't exceed 12
      } else if (firstDigit === 0 && digit === 0) {
        event.preventDefault(); // Can't have 00
      }
    } else if (cursorPosition === 3) {
      // First digit of day: 0, 1, 2, or 3
      if (digit > 3) {
        event.preventDefault();
      }
    } else if (cursorPosition === 4) {
      // Second digit of day
      const firstDigit = parseInt(currentValue[3] || "0");
      if (firstDigit === 3 && digit > 1) {
        event.preventDefault(); // Can't exceed 31
      } else if (firstDigit === 0 && digit === 0) {
        event.preventDefault(); // Can't have 00
      }
    } else if (cursorPosition === 6) {
      // First digit of year: 1 or 2 for reasonable dates
      if (digit < 1 || digit > 2) {
        event.preventDefault();
      }
    }
  }

  previousPeriod() {
    if (this.viewMode() === "day") {
      const current = this.currentMonth();
      this.currentMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    } else if (this.viewMode() === "month") {
      this.currentYear.set(this.currentYear() - 1);
    } else if (this.viewMode() === "year") {
      this.currentDecade.set(this.currentDecade() - 10);
    }
  }

  nextPeriod() {
    if (this.viewMode() === "day") {
      const current = this.currentMonth();
      this.currentMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    } else if (this.viewMode() === "month") {
      this.currentYear.set(this.currentYear() + 1);
    } else if (this.viewMode() === "year") {
      this.currentDecade.set(this.currentDecade() + 10);
    }
  }

  switchToNextView() {
    if (this.viewMode() === "day") {
      this.currentYear.set(this.currentMonth().getFullYear());
      this.viewMode.set("month");
    } else if (this.viewMode() === "month") {
      this.currentDecade.set(Math.floor(this.currentYear() / 10) * 10);
      this.viewMode.set("year");
    }
  }

  getHeaderTitle(): string {
    if (this.viewMode() === "day") {
      return this.monthName();
    } else if (this.viewMode() === "month") {
      return this.currentYear().toString();
    } else {
      const decade = this.currentDecade();
      return `${decade} - ${decade + 9}`;
    }
  }

  selectMonth(monthIndex: number) {
    this.currentMonth.set(new Date(this.currentYear(), monthIndex, 1));
    this.viewMode.set("day");
  }

  selectYear(year: number) {
    this.currentYear.set(year);
    this.currentMonth.set(new Date(year, this.currentMonth().getMonth(), 1));
    this.viewMode.set("month");
  }

  selectDate(day: CalendarDay) {
    this.selectedDate.set(day.date);
    this.dateInput.nativeElement.value = this.formatDate(day.date);
    this.notifyOnChange?.(this.formatDateForForm(day.date));
    this.popoverTrigger?.closePopover();
  }

  clearDate() {
    this.selectedDate.set(null);
    this.dateInput.nativeElement.value = "";
    this.notifyOnChange?.(null);
    this.popoverTrigger?.closePopover();
  }

  closeCalendar() {
    this.popoverTrigger?.closePopover();
  }

  getDayClasses(day: CalendarDay): string {
    const baseClasses =
      "tw-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-text-sm tw-rounded-full";

    if (!day.inCurrentMonth) {
      return `${baseClasses} tw-text-muted tw-cursor-default`;
    }

    const isSelected = this.selectedDate() && this.isSameDay(day.date, this.selectedDate()!);

    if (isSelected) {
      return `${baseClasses} tw-bg-primary-600 tw-text-contrast tw-cursor-pointer`;
    }

    return `${baseClasses} tw-text-main tw-cursor-pointer hover:tw-bg-primary-600 hover:tw-text-contrast`;
  }

  private generateCalendarDays(monthDate: Date): CalendarDay[] {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    // Adjust for Monday start (0 = Monday)
    const dayOfWeek = firstDay.getDay();
    const mondayStart = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - mondayStart);

    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      // 6 weeks * 7 days
      days.push({
        date: new Date(currentDate),
        inCurrentMonth: currentDate.getMonth() === month,
        isToday: this.isSameDay(currentDate, new Date()),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }

  private formatAndValidateInput(value: string): string {
    // Remove any non-digit characters except /
    const cleaned = value.replace(/[^\d/]/g, "");
    let result = "";
    let digitCount = 0;

    for (let i = 0; i < cleaned.length && result.length < 10; i++) {
      const char = cleaned[i];

      if (char === "/") {
        // Only add slash if we have the right number of digits
        if (digitCount === 2 && result.length === 2) {
          result += "/";
        } else if (digitCount === 4 && result.length === 5) {
          result += "/";
        }
      } else {
        // Add slashes automatically after 2 and 4 digits
        if (digitCount === 2 && result.length === 2) {
          result += "/";
        } else if (digitCount === 4 && result.length === 5) {
          result += "/";
        }

        result += char;
        digitCount++;
      }
    }

    return result;
  }

  private updateCalendarFromInput(value: string) {
    const parts = value.split("/");

    // Update calendar as user types
    if (parts[0] && parts[0].length === 2) {
      const month = parseInt(parts[0]) - 1; // 0-based month

      if (month >= 0 && month <= 11) {
        let year = new Date().getFullYear(); // Default to current year

        // If year is being typed, use that
        if (parts.length === 3 && parts[2].length >= 1) {
          const yearInput = parts[2];
          if (yearInput.length === 4) {
            year = parseInt(yearInput);
          } else if (yearInput.length >= 2) {
            // Assume 20xx for partial year input starting with 20, 19xx for 19
            const prefix = yearInput.substring(0, 2);
            if (prefix === "20" || prefix === "19") {
              year = parseInt(prefix + "00");
            }
          }
        }

        // Update calendar to show the typed month/year
        const targetDate = new Date(year, month, 1);
        this.currentMonth.set(targetDate);
        this.currentYear.set(year);

        // If we have complete date, select it
        if (
          parts.length === 3 &&
          parts[1] &&
          parts[2] &&
          parts[1].length === 2 &&
          parts[2].length === 4
        ) {
          const day = parseInt(parts[1]);
          if (day >= 1 && day <= 31) {
            const fullDate = new Date(year, month, day);
            if (fullDate.getMonth() === month) {
              // Valid date check
              this.selectedDate.set(fullDate);
            }
          }
        }
      }
    }
  }

  private formatDate(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  private formatDateForForm(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    // Handle MM/DD/YYYY format
    if (value.includes("/")) {
      const parts = value.split("/");
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
          const date = new Date(year, month, day);
          // Validate the date is what we expect (handles invalid dates like 02/30)
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
          }
        }
      }
    }

    // Handle YYYY-MM-DD format (from form)
    if (value.includes("-")) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);

        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day);
        }
      }
    }

    return null;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  // ControlValueAccessor implementation
  writeValue(value: string | null): void {
    const date = this.parseDate(value);
    this.selectedDate.set(date);
    if (date && this.dateInput?.nativeElement) {
      this.dateInput.nativeElement.value = this.formatDate(date);
      this.currentMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.notifyOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
