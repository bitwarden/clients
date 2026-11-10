import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatCalendarDate } from "@bitwarden/bit-pam";

/** "Nov 4, 2026". Empty for a bad value. */
@Pipe({ name: "calendarDate" })
export class CalendarDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date | string | number | null | undefined): string {
    return formatCalendarDate(this.locale, new Date(value ?? Number.NaN).getTime());
  }
}
