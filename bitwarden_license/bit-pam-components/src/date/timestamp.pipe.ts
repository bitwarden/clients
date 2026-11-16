import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatTimestamp } from "@bitwarden/bit-pam";

/** "Nov 4, 2026, 3:45 PM", plus the seconds for `"second"`. Empty for a bad value. */
@Pipe({ name: "timestamp" })
export class TimestampPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(
    value: Date | string | number | null | undefined,
    precision: "minute" | "second" = "minute",
  ): string {
    return formatTimestamp(this.locale, new Date(value ?? Number.NaN).getTime(), precision);
  }
}
